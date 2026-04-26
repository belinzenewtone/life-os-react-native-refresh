import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { getDatabase } from '@/core/data/database/client';
import { AppTelemetry } from '@/core/observability/app-telemetry';
import { buildDedupeKeys, isDuplicate } from '@/core/platform/sms/mpesa-dedupe';
import { isNearDuplicateMerchant } from '@/core/platform/sms/mpesa-fuzzy-dedupe';
import { parseMpesaSms } from '@/core/platform/sms/mpesa-parser';
import { ConfidenceBasedImportFilter } from '@/core/platform/sms/confidence-based-import-filter';
import { SemanticHashEngine } from '@/core/platform/sms/semantic-hash-engine';
import { FulizaRepository } from '@/core/repositories/fuliza-repository';
import { ImportAuditRepository } from '@/core/repositories/import-audit-repository';
import { MerchantCategoryRepository } from '@/core/repositories/merchant-category-repository';
import { PaybillRegistryRepository } from '@/core/repositories/paybill-registry-repository';

// ── Known merchant categorizer ──────────────────────────────────────────────

import { KNOWN_MERCHANTS } from '@/core/platform/sms/merchant-category-data';

function classifyKnownMerchant(merchant: string | null): string | null {
  if (!merchant) return null;
  const key = merchant.toLowerCase().trim();
  for (const [knownKey, category] of Object.entries(KNOWN_MERCHANTS)) {
    if (key.includes(knownKey)) return category;
  }
  return null;
}

// ── Type → category mapping (used by inferCategory) ─────────────────────────

const TYPE_CATEGORY_MAP: Record<string, string> = {
  SENT: 'Transfer',
  RECEIVED: 'M-Pesa Received',
  AIRTIME: 'Airtime',
  WITHDRAWN: 'Withdrawal',
  DEPOSIT: 'Deposit',
  FULIZA_CHARGE: 'Fuliza Charge',
  FULIZA_REPAYMENT: 'Loans & Credit',
  REVERSED: 'Reversal',
  MSHWARI_LOAN: 'Loans & Credit',
  MSHWARI_SAVINGS: 'Savings',
  KCB_LOAN: 'Loans & Credit',
  KCB_SAVINGS: 'Savings',
  POCHI_LA_BIASHARA: 'Business',
};

// ── Category inference ────────────────────────────────────────────────────

async function inferCategory(userId: string, input: { merchant: string | null; userCorrected: boolean; type: string; rawSms: string }) {
  const merchant = (input.merchant ?? '').toLowerCase();
  const raw = input.rawSms.toLowerCase();

  // 1. Fast in-memory lookup against known merchant dictionary
  if (input.merchant) {
    const known = classifyKnownMerchant(input.merchant);
    if (known) {
      return { category: known, source: 'KNOWN_MERCHANT' as const };
    }
  }

  // 2. Single DB lookup for user-corrected / auto-learned merchant category
  if (input.merchant) {
    const record = await MerchantCategoryRepository.findByMerchant(userId, input.merchant);
    if (record) {
      return { category: record.category, source: 'MERCHANT_CATEGORY' as const };
    }
  }

  if (input.type === 'FULIZA_CHARGE') {
    return { category: 'Loans', source: 'HEURISTIC_FULIZA' as const };
  }

  // 3. Paybill → registry or heuristic
  // Require keyword (PAYBILL|ACCOUNT|TO|ACC|BUY GOODS) before the digits so that
  // phone numbers like "0712345678 Confirmed" are NOT mistaken for paybill numbers.
  if (input.type === 'PAYBILL') {
    const match = raw.match(/(?<=\b(PAYBILL|ACCOUNT|TO|ACC|BUY GOODS)\s)\d{5,10}(?=\s|$)/i);
    if (match) {
      const number = match[0];
      const record = await PaybillRegistryRepository.lookup(userId, number);
      if (record) {
        return { category: record.category, source: 'PAYBILL_REGISTRY' as const };
      }
    }
  }

  // 4. Type-based semantic category
  if (TYPE_CATEGORY_MAP[input.type]) {
    return { category: TYPE_CATEGORY_MAP[input.type], source: 'MPESA_KIND' as const };
  }

  // 5. For Paybill without registry match, use heuristic
  if (input.type === 'PAYBILL') {
    if (/(kplc|kenya power|electricity|water|nairobi water)/i.test(`${merchant} ${raw}`)) {
      return { category: 'Bills', source: 'HEURISTIC_MERCHANT' as const };
    }
    return { category: 'Bills', source: 'HEURISTIC_DEFAULT' as const };
  }

  // 6. Keyword-based heuristics (order matters — first match wins)
  if (/(coffee|restaurant|grocer|food|supermarket|baker|butcher|cafe|diner|fast food|takeaway)/.test(`${merchant} ${raw}`)) {
    return { category: 'Food', source: 'HEURISTIC_MERCHANT' as const };
  }
  if (/(uber|bolt|taxi|matatu|fuel|petrol|transport|gas station|filling station)/.test(`${merchant} ${raw}`)) {
    return { category: 'Transport', source: 'HEURISTIC_MERCHANT' as const };
  }
  if (/(rent|token|electricity|water|power|bill|paybill)/.test(`${merchant} ${raw}`)) {
    return { category: 'Bills', source: 'HEURISTIC_MERCHANT' as const };
  }
  if (/(movie|cinema|game|club|nightlife|concert|theatre|theater)/.test(`${merchant} ${raw}`)) {
    return { category: 'Entertainment', source: 'HEURISTIC_MERCHANT' as const };
  }
  if (/(pharmacy|hospital|clinic|doctor|medical|health)/.test(`${merchant} ${raw}`)) {
    return { category: 'Health', source: 'HEURISTIC_MERCHANT' as const };
  }
  if (/(school|university|college|exam|course|tuition|education)/.test(`${merchant} ${raw}`)) {
    return { category: 'Education', source: 'HEURISTIC_MERCHANT' as const };
  }
  if (/(insurance|pension|investment|savings|saving)/.test(`${merchant} ${raw}`)) {
    return { category: 'Savings', source: 'HEURISTIC_MERCHANT' as const };
  }

  return { category: 'Other', source: 'HEURISTIC_DEFAULT' as const };
}

// ── Default merchant guard for heuristic dedupe ────────────────────────────

const DEFAULT_MERCHANTS = new Set(['Cash Deposit', 'Airtime Purchase', 'ATM Withdrawal', 'M-Pesa']);

function isDefaultMerchant(merchant: string | null): boolean {
  return !merchant || DEFAULT_MERCHANTS.has(merchant);
}

// ── Amount banding ─────────────────────────────────────────────────────────

function amountBand(amount: number | null): string {
  if (amount == null) return 'unknown';
  if (amount < 100) return 'lt_100';
  if (amount < 1000) return '100_999';
  if (amount < 10000) return '1000_9999';
  return '10000_plus';
}

// ── SHA-256 helper ─────────────────────────────────────────────────────────

async function sha256(input: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

// ── Ingestion service ──────────────────────────────────────────────────────

export class MpesaIngestionService {
  static async ingestSms(userId: string, rawSms: string, receivedAt?: number) {
    try {
      const parsed = parseMpesaSms(rawSms);
      const sourceHash = await sha256(rawSms);

      AppTelemetry.trackEvent('parser_result', {
        outcome: parsed.type === 'UNKNOWN' ? 'parse_failed' : parsed.type === 'FULIZA_CHARGE' || parsed.type === 'FULIZA_BALANCE' ? 'fuliza_balance_updated' : 'parsed',
        has_mpesa_code: String(!!parsed.code),
        amount_band: amountBand(parsed.amount),
        has_merchant: String(!!parsed.merchant),
        confidence: parsed.confidence,
      });

      // ── FULIZA_CHARGE short-circuit ──────────────────────────────────────
      // FULIZA_CHARGE: has an explicit access fee → record draw + update outstanding
      if (parsed.type === 'FULIZA_CHARGE') {
        if (parsed.fulizaOutstanding != null) {
          await FulizaRepository.setOutstanding(userId, parsed.fulizaOutstanding);
        }
        if (parsed.fulizaFee != null && parsed.fulizaFee > 0) {
          const drawCode = `draw_${Date.now()}_${Math.round(Math.random() * 100000)}`;
          await FulizaRepository.recordDraw(userId, drawCode, parsed.fulizaFee, Date.now());
        }
        await ImportAuditRepository.add(userId, {
          source: Platform.OS === 'android' ? 'SMS_ANDROID' : 'SMS_MANUAL',
          status: 'FULIZA_BALANCE_UPDATED',
          message: 'Fuliza access fee recorded from SMS',
          mpesa_code: parsed.code,
          amount: parsed.amount,
          amount_band: amountBand(parsed.amount),
          payload: JSON.stringify({ parsed }),
        });
        return { inserted: false, duplicate: false, parsed, outcome: 'FULIZA_BALANCE_UPDATED' as const };
      }

      // ── FULIZA_BALANCE short-circuit ─────────────────────────────────────
      // FULIZA_BALANCE: cumulative balance notice only → update outstanding, no draw
      if (parsed.type === 'FULIZA_BALANCE') {
        if (parsed.fulizaOutstanding != null) {
          await FulizaRepository.setOutstanding(userId, parsed.fulizaOutstanding);
        }
        await ImportAuditRepository.add(userId, {
          source: Platform.OS === 'android' ? 'SMS_ANDROID' : 'SMS_MANUAL',
          status: 'FULIZA_BALANCE_UPDATED',
          message: 'Fuliza cumulative balance updated from SMS',
          mpesa_code: parsed.code,
          amount: parsed.amount,
          amount_band: amountBand(parsed.amount),
          payload: JSON.stringify({ parsed }),
        });
        return { inserted: false, duplicate: false, parsed, outcome: 'FULIZA_BALANCE_UPDATED' as const };
      }

      // ── Confidence-based import filter ───────────────────────────────────
      const filterDecision = ConfidenceBasedImportFilter.evaluate(parsed);

      if (filterDecision.action === 'QUARANTINE') {
        AppTelemetry.trackEvent('parser_quarantine', {
          reason: filterDecision.reason,
          amount_band: amountBand(parsed.amount),
        });
        await ImportAuditRepository.add(userId, {
          source: Platform.OS === 'android' ? 'SMS_ANDROID' : 'SMS_MANUAL',
          status: 'QUARANTINED',
          message: `Quarantined: ${filterDecision.reason}`,
          mpesa_code: parsed.code,
          amount: parsed.amount,
          amount_band: amountBand(parsed.amount),
          payload: JSON.stringify({ parsed, filter: filterDecision }),
        });
        return { inserted: false, duplicate: false, parsed, outcome: 'QUARANTINED' as const };
      }

      // ── Semantic hash ──
      const semanticHash = await SemanticHashEngine.compute({
        amount: parsed.amount,
        date: parsed.smsDate ?? receivedAt ?? Date.now(),
        merchant: parsed.merchant,
      });

      const db = await getDatabase();
      const existing = await db.getAllAsync<{ mpesa_code: string | null; source_hash: string | null; semantic_hash: string | null }>(
        `SELECT mpesa_code,source_hash,semantic_hash
         FROM transactions
         WHERE user_id = ? AND (mpesa_code = ? OR source_hash = ? OR semantic_hash = ?)
         LIMIT 5`,
        userId,
        parsed.code,
        sourceHash,
        semanticHash,
      );

      const existingKeys = new Set(
        existing.flatMap((row) =>
          [row.mpesa_code, row.source_hash, row.semantic_hash].filter((value): value is string => Boolean(value)),
        ),
      );
      const nextKeys = buildDedupeKeys({ mpesaCode: parsed.code, sourceHash, semanticHash });
      const duplicate = isDuplicate(existingKeys, nextKeys);

      // ── Tier 4: Heuristic dedupe ──
      // Skip heuristic dedupe for default merchants to avoid losing legitimate duplicates
      // (e.g. buying airtime twice in 5 minutes)
      // Uses fuzzy merchant matching (Levenshtein) to catch typos
      if (!duplicate && parsed.amount != null && !isDefaultMerchant(parsed.merchant)) {
        const effectiveTs = parsed.smsDate ?? receivedAt ?? Date.now();
        const windowStart = effectiveTs - 5 * 60 * 1000;
        const windowEnd = effectiveTs + 5 * 60 * 1000;
        const candidates = await db.getAllAsync<{ id: string; merchant: string }>(
          `SELECT id, merchant FROM transactions
           WHERE user_id = ? AND amount = ? AND date BETWEEN ? AND ?
           LIMIT 10`,
          userId,
          parsed.amount,
          windowStart,
          windowEnd,
        );
        const matched = candidates.find((c) =>
          c.merchant === parsed.merchant || isNearDuplicateMerchant(c.merchant, parsed.merchant),
        );
        if (matched) {
          AppTelemetry.trackEvent('dedupe_hit', { tier: 'heuristic_5min', transaction_type: parsed.type });
          await ImportAuditRepository.add(userId, {
            source: Platform.OS === 'android' ? 'SMS_ANDROID' : 'SMS_MANUAL',
            status: 'DUPLICATE',
            message: 'Skipped duplicate M-Pesa SMS (heuristic 5-min window)',
            mpesa_code: parsed.code,
            amount: parsed.amount,
            amount_band: amountBand(parsed.amount),
            payload: JSON.stringify({ parsed }),
          });
          return { inserted: false, duplicate: true, parsed };
        }
      }

      if (duplicate) {
        AppTelemetry.trackEvent('dedupe_hit', { tier: 'code_source_or_semantic', transaction_type: parsed.type });
        await ImportAuditRepository.add(userId, {
          source: Platform.OS === 'android' ? 'SMS_ANDROID' : 'SMS_MANUAL',
          status: 'DUPLICATE',
          message: 'Skipped duplicate M-Pesa SMS',
          mpesa_code: parsed.code,
          amount: parsed.amount,
          amount_band: amountBand(parsed.amount),
          payload: JSON.stringify({ parsed }),
        });
        return { inserted: false, duplicate: true, parsed };
      }

      const id = `tx_${Crypto.randomUUID()}`;
      const inferred = await inferCategory(userId, { merchant: parsed.merchant, userCorrected: false, type: parsed.type, rawSms });
      const nowIso = new Date().toISOString();
      const transactionDate = parsed.smsDate ?? receivedAt ?? Date.now();
      await db.runAsync(
        `INSERT INTO transactions (
          user_id,id,amount,merchant,category,date,source,transaction_type,mpesa_code,source_hash,semantic_hash,raw_sms,
          balance,transaction_cost,inferred_category,inference_source,created_at,updated_at,sync_state,record_source,revision,deleted_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        userId,
        id,
        parsed.amount ?? 0,
        parsed.merchant ?? 'M-Pesa',
        inferred.category,
        transactionDate,
        'MPESA',
        parsed.type,
        parsed.code,
        sourceHash,
        semanticHash,
        rawSms,
        parsed.balance,
        parsed.transactionCost,
        inferred.category,
        inferred.source,
        nowIso,
        nowIso,
        filterDecision.action === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : 'QUEUED',
        'SMS',
        1,
        null,
      );

      // ── Fuliza draw tracking ──
      // If a regular transaction (SENT, AIRTIME, etc.) contains Fuliza context, record as a draw.
      const FULIZA_DRAW_TYPES = new Set(['SENT', 'AIRTIME', 'PAYBILL', 'BUY_GOODS', 'WITHDRAWN', 'POCHI_LA_BIASHARA']);
      if (FULIZA_DRAW_TYPES.has(parsed.type) && rawSms.toLowerCase().includes('fuliza')) {
        await FulizaRepository.recordDraw(userId, parsed.code ?? `tx_${id}`, parsed.amount ?? 0, transactionDate);
        AppTelemetry.trackEvent('fuliza_draw', { transaction_type: parsed.type, amount: parsed.amount ?? 0 });
      }

      // ── Fuliza repayment ──
      if (parsed.type === 'FULIZA_REPAYMENT') {
        await FulizaRepository.recordRepayment(userId, parsed.code ?? '', parsed.amount ?? 0, transactionDate);
        if (parsed.fulizaAvailableLimit != null) {
          await FulizaRepository.setAvailableLimit(userId, parsed.fulizaAvailableLimit);
        }
      }

      const importStatus = filterDecision.action === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : 'IMPORTED';
      await ImportAuditRepository.add(userId, {
        source: Platform.OS === 'android' ? 'SMS_ANDROID' : 'SMS_MANUAL',
        status: importStatus,
        message: `M-Pesa SMS ${filterDecision.action === 'PENDING_REVIEW' ? 'imported for review' : 'parsed and ingested'}`,
        mpesa_code: parsed.code,
        amount: parsed.amount,
        amount_band: amountBand(parsed.amount),
        payload: JSON.stringify({ parsed, filter: filterDecision }),
      });

      return { inserted: true, duplicate: false, parsed, outcome: importStatus };
    } catch (error) {
      AppTelemetry.captureError(error, { context: 'sms_ingestion', rawSmsLength: String(rawSms.length) }, 'error');
      await ImportAuditRepository.add(userId, {
        source: Platform.OS === 'android' ? 'SMS_ANDROID' : 'SMS_MANUAL',
        status: 'ERROR',
        message: `Ingestion error: ${error instanceof Error ? error.message : String(error)}`,
        mpesa_code: null,
        amount: null,
        amount_band: 'unknown',
        payload: JSON.stringify({ rawSms: rawSms.slice(0, 500) }),
      });
      return { inserted: false, duplicate: false, parsed: null, error: String(error) };
    }
  }

  static async ingestSample(userId: string) {
    const sample = 'QAB123CDE4 Confirmed. Ksh450.00 sent to Artisan Coffee on 22/04/26 at 8:42 AM. New M-PESA balance is Ksh2,103.00.';
    return this.ingestSms(userId, sample);
  }

  /**
   * Learns from a user-corrected categorization.
   * If the transaction is a PAYBILL, auto-registers the paybill→category mapping.
   * Also updates the merchant category mapping.
   */
  static async learnFromCorrection(
    userId: string,
    input: {
      transactionId: string;
      merchant: string | null;
      category: string;
      rawSms: string;
      transactionType: string;
    },
  ): Promise<void> {
    // Update merchant category
    if (input.merchant) {
      await MerchantCategoryRepository.setCategory(userId, input.merchant, input.category, true);
    }

    // Auto-learn paybill registry for PAYBILL transactions
    if (input.transactionType === 'PAYBILL') {
      await PaybillRegistryRepository.learnFromCorrection(userId, input.rawSms, input.category);
    }

    AppTelemetry.trackEvent('category_correction_learned', {
      merchant: input.merchant ?? 'unknown',
      category: input.category,
      transaction_type: input.transactionType,
    });
  }
}