/**
 * M-Pesa SMS parser — comprehensive 6-stage pipeline matching Kotlin architecture:
 *
 * Stage 0: Fast filter — is this even an M-Pesa SMS?
 * Stage 1: Extract 10-char transaction code (required)
 * Stage 2: Extract positive amount (required)
 * Stage 3: Classify transaction via 3-phase detection rules
 * Stage 4: Extract counterparty/merchant name
 * Stage 5: Extract balance + Fuliza enrichment (outstanding, available limit)
 * Stage 6: Build confidence score
 *
 * Rule order: REVERSAL > RECEIVED > DEPOSIT > AIRTIME > PAYBILL > BUY_GOODS >
 * WITHDRAWAL > FULIZA_CHARGE > FULIZA_REPAYMENT > SENT (catch-all)
 *
 * Order is critical: earlier rules prevent later (broader) rules from
 * mis-classifying overlapping keywords.
 */

// ── Stage 0: Fast filter ─────────────────────────────────────────────────

const MPESA_SIGNAL_RE = /MPESA|M-PESA/i;
// M-Pesa codes are 10-char alphanumeric and always contain at least one letter.
// Pure 10-digit strings (phone numbers) must be excluded.
const CODE_RE = /\b(?=[A-Z0-9]{10}\b)[A-Z0-9]*[A-Z][A-Z0-9]*/i;
const AMOUNT_RE = /(?:ksh|kes)[.\s]*[\d,]+(?:\.\d+)?/i;

// Promotional / marketing SMS that should be excluded
const PROMO_SIGNALS = /\b(?:win|congratulations|bonus|prize|reward|offer|promo|free airtime)\b/i;

export function isMpesaSms(raw: string): boolean {
  if (PROMO_SIGNALS.test(raw)) return false;
  if (MPESA_SIGNAL_RE.test(raw)) return true;
  return CODE_RE.test(raw.trim()) && AMOUNT_RE.test(raw);
}

// ── Fuliza service notice filter (Stage 0b) ────────────────────────────────

const FULIZA_NOTICE_SIGNALS = [
  'access fee charged',
  'outstanding amount is',
  'daily charges',
  'query charges',
  'select query charges',
  'interest accrual',
  'interest charged',
  'interest accrued',
  'maintenance fee',
  'overdraft balance',
  'overdraft notice',
  'fuliza service charge',
];

export function isFulizaServiceNotice(raw: string): boolean {
  const text = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text.includes('fuliza')) return false;
  if (text.includes('total fuliza m-pesa outstanding amount is')) return false;
  return FULIZA_NOTICE_SIGNALS.some((signal) => text.includes(signal));
}

// ── Stage 3: 3-Phase Detection Rules ──────────────────────────────────────

type DetectionRule = {
  id: string;
  primaryPatterns: RegExp[];
  fallbackPatterns: RegExp[];
  lastResortPatterns: RegExp[];
  counterpartyPatterns: RegExp[];
  value: string;
};

const DETECTION_RULES: DetectionRule[] = [
  {
    id: 'reversed',
    primaryPatterns: [/\brevers(?:al|ed)\s+(?:to|of|on)\b/i],
    fallbackPatterns: [/\brevers(?:al|ed|ing)?\b/i],
    lastResortPatterns: [/\bhas been reversed\b/i],
    counterpartyPatterns: [
      /received\s+from\s+(.+?)(?:\s+on\s|\s+New\s|\.|$)/i,
      /sent\s+to\s+(.+?)(?:\s+on\s|\s+New\s|\.|$)/i,
    ],
    value: 'REVERSED',
  },
  // ── Product-specific rules (must come BEFORE generic rules) ──
  {
    id: 'fuliza_charge',
    primaryPatterns: [
      /Fuliza M-PESA amount is\s*(?:Ksh|KES)\s?[\d,.]+.*Access Fee charged/i,
    ],
    fallbackPatterns: [/\bfuliza\s+charge\b/i],
    lastResortPatterns: [/\bfuliza\b.*\baccess fee\b/i],
    counterpartyPatterns: [/(Fuliza M-PESA)/i],
    value: 'FULIZA_CHARGE',
  },
  {
    id: 'fuliza_balance',
    primaryPatterns: [
      /Total Fuliza M-PESA outstanding amount is\s*(?:Ksh|KES)\s?[\d,]+(?:\.\d+)?/i,
    ],
    fallbackPatterns: [/\bfuliza\s+balance\b/i],
    lastResortPatterns: [/\bfuliza\b.*\boutstanding\b/i],
    counterpartyPatterns: [/(Fuliza M-PESA)/i],
    value: 'FULIZA_BALANCE',
  },
  {
    id: 'fuliza_repayment',
    primaryPatterns: [
      /\bfuliza\s+repayment\b.*\bfrom\b/i,
      /\byour\s+m-pesa\s+has\s+been\s+used\s+to\s+repay\b/i,
    ],
    fallbackPatterns: [
      /\bfuliza\b.*\brepayment\b/i,
      /\byour\s+m-pesa\s+has\s+been\s+used\s+to\s+repay.*\bfuliza\b/i,
    ],
    lastResortPatterns: [
      /\bfrom your m-pesa has been used to\b.*\boutstanding fuliza\b/i,
    ],
    counterpartyPatterns: [/(Fuliza M-PESA)/i],
    value: 'FULIZA_REPAYMENT',
  },
  {
    id: 'mshwari_loan',
    primaryPatterns: [
      /\bloan\s+from\s+m-shwari\b/i,
      /\bm-shwari\s+loan\b/i,
      /\bloan\s+disbursed\b.*\bm-shwari\b/i,
    ],
    fallbackPatterns: [/\bm-shwari\b.*\bloan\b/i, /\bloan\b.*\bm-shwari\b/i],
    lastResortPatterns: [/\bm-shwari\b/i],
    counterpartyPatterns: [/(M-Shwari)/i],
    value: 'MSHWARI_LOAN',
  },
  {
    id: 'mshwari_savings',
    primaryPatterns: [
      /\bsaved?\s+to\s+m-shwari\b/i,
      /\bm-shwari\s+savings?\b/i,
      /\bwithdrawn?\s+from\s+m-shwari\s+savings?\b/i,
    ],
    fallbackPatterns: [/\bm-shwari\b.*\bsavings?\b/i, /\bsavings?\b.*\bm-shwari\b/i],
    lastResortPatterns: [],
    counterpartyPatterns: [/(M-Shwari)/i],
    value: 'MSHWARI_SAVINGS',
  },
  {
    id: 'kcb_loan',
    primaryPatterns: [
      /\bkcb\s+m-pesa\s+loan\b/i,
      /\bloan\s+disbursed.*\bkcb\b/i,
      /\bkcb\s+m-pesa.*\bloan\b/i,
    ],
    fallbackPatterns: [/\bkcb\b.*\bloan\b/i, /\bloan\b.*\bkcb\b/i],
    lastResortPatterns: [/\bkcb\s+m-pesa\b/i],
    counterpartyPatterns: [/(KCB M-PESA)/i],
    value: 'KCB_LOAN',
  },
  {
    id: 'kcb_savings',
    primaryPatterns: [
      /\bdeposited?\s+to\s+kcb\s+m-pesa\s+savings?\b/i,
      /\bkcb\s+m-pesa\s+savings?\b/i,
      /\bwithdrawn?\s+from\s+kcb\s+m-pesa\s+savings?\b/i,
    ],
    fallbackPatterns: [/\bkcb\b.*\bsavings?\b/i, /\bsavings?\b.*\bkcb\b/i],
    lastResortPatterns: [],
    counterpartyPatterns: [/(KCB M-PESA)/i],
    value: 'KCB_SAVINGS',
  },
  {
    id: 'pochi_la_biashara',
    primaryPatterns: [
      /\bpochi\s+la\s+biashara\b/i,
    ],
    fallbackPatterns: [/\bpochi\b/i],
    lastResortPatterns: [],
    counterpartyPatterns: [
      /received\s+from\s+(.+?)\s+via\s+pochi/i,
      /sent\s+from\s+(?:your\s+)?till\s+number\s+\d+\s+via\s+pochi/i,
    ],
    value: 'POCHI_LA_BIASHARA',
  },
  // ── Generic rules (after product-specific) ──
  {
    id: 'received',
    primaryPatterns: [/\breceived\s+(?:from|Ksh|KES)\b/i, /\bcredited\s+(?:to|in|into)\b/i],
    fallbackPatterns: [/\breceived|credited\b/i],
    lastResortPatterns: [/\breceived from\b/i, /\byou have received\b/i],
    counterpartyPatterns: [
      /received\s+(?:Ksh|KES)\s?[\d,.]+\s+from\s+(.+?)(?:\s+on\s|\s+New\s|\.|$)/i,
      /(?:Ksh|KES)\s?[\d,.]+\s+received\s+from\s+(.+?)(?:\s+on\s|\s+New\s|\.|$)/i,
    ],
    value: 'RECEIVED',
  },
  {
    id: 'deposit',
    primaryPatterns: [/\bdeposit(?:ed)?\s+(?:to|into|at|agent)\b/i],
    fallbackPatterns: [/\bdeposit(?:ed)?\b/i],
    lastResortPatterns: [/(?:^|\s)deposited\b/i, /\bcash deposit\b/i],
    counterpartyPatterns: [],
    value: 'DEPOSIT',
  },
  {
    id: 'airtime',
    primaryPatterns: [/\bairtime\b.*\bsent\b/i, /\bsent.*\bairtime\b/i],
    fallbackPatterns: [/\bairtime\b/i],
    lastResortPatterns: [/\bfor airtime\b/i, /\bbought\b.*\bairtime\b/i],
    counterpartyPatterns: [
      /sent\s+to\s+(.+?)\s+for\s+airtime/i,
    ],
    value: 'AIRTIME',
  },
  {
    id: 'paybill',
    primaryPatterns: [/\bpay(?:\s*bill|bill)\b.*(?:account|business)/i, /\bPayBill\b/i, /\bsent\s+to\b.*\bfor\s*account\b/i],
    fallbackPatterns: [/\bpay\s*bill|paybill\b/i],
    lastResortPatterns: [
      /(?:sent|paid)\s+to\b.*(?:account|for account)/i,
    ],
    counterpartyPatterns: [
      /(?:Ksh|KES)\s?[\d,.]+\s+sent\s+to\s+(.+?)\s+(?:for\s*account|account)\s+[\w-]+/i,
      /paid\s+to\s+(.+?)\s+(?:for\s*account|account)\s+[\w-]+/i,
      /sent\s+to\s+(.+?)\s+(?:for\s*account|account)\s+[\w-]+/i,
    ],
    value: 'PAYBILL',
  },
  {
    id: 'buy_goods',
    primaryPatterns: [/\bbuy\s+goods\b/i, /\btill\s+number\b/i, /\bpaid\s+to\b/i],
    fallbackPatterns: [/\bbuy\s*goods\b/i],
    lastResortPatterns: [],
    counterpartyPatterns: [
      /buy\s+goods\s+from\s+(.+?)(?:\s+on\s|\.|$)/i,
      /(?:Ksh|KES)\s?[\d,.]+\s+paid\s+to\s+(.+?)\s+via\s+kopo\s+kopo(?:\.\s|\s+on\s|\s+New\s|$)/i,
      /(?:Ksh|KES)\s?[\d,.]+\s+paid\s+to\s+(.+?)(?:\s+on\s\d|\.\s|confirmed|$)/i,
      /paid\s+to\s+(.+?)(?:\s+on\s\d|\s+on\s+New\s|\.\s|confirmed|$)/i,
    ],
    value: 'BUY_GOODS',
  },
  {
    id: 'withdrawal',
    primaryPatterns: [/\bwithdraw(?:al|n)?\s+(?:from|at|agent)\b/i],
    fallbackPatterns: [/\bwithdraw(?:al|n)?\b/i],
    lastResortPatterns: [/\bwithdrawn from agent\b/i, /\bcash withdrawal\b/i],
    counterpartyPatterns: [
      /withdrawn\s+from(?: agent)?\s+\d+\s*-?\s*(.+?)(?:\s+on\s|\s+New\s|\.|$)/i,
    ],
    value: 'WITHDRAWN',
  },
  {
    id: 'sent',
    primaryPatterns: [/\bsent\s+to\b/i],
    fallbackPatterns: [/\bsent\b/i],
    lastResortPatterns: [/\btransferred\b/i],
    counterpartyPatterns: [
      /(?:Ksh|KES)\s?[\d,.]+\s+sent\s+to\s+(.+?)(?:\s+on\s|\s+New\s|\.|confirmed|$)/i,
      /customer\s+transfer\s+of\s+(?:Ksh|KES)\s?[\d,.]+\s+to\s+(.+?)(?:\s+on\s|\s+New\s|\.|confirmed|$)/i,
      /\bsent\s+to\s+(.+?)(?:\s+on\s|\s+New\s|\.|confirmed|for\s+airtime|$)/i,
    ],
    value: 'SENT',
  },
];

// ── Extracted types ──────────────────────────────────────────────────────

export type MpesaConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type ParsedMpesa = {
  code: string | null;
  amount: number | null;
  merchant: string | null;
  type: DetectionRule['value'] | 'UNKNOWN';
  confidence: MpesaConfidence;
  detectionPhase: 'PRIMARY' | 'FALLBACK' | 'LAST_RESORT' | 'NONE' | null;
  smsDate: number | null;
  balance: number | null;
  transactionCost: number | null;
  fulizaOutstanding: number | null;
  fulizaAvailableLimit: number | null;
  fulizaFee: number | null;
};

// ── Helper functions ──────────────────────────────────────────────────────

function cleanupMerchant(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const suffixes = /\b(?:on|new|balance|transaction|ref)\b/i;
  const accountRef = /\s+for\s+account(?:\s+number)?\b.*$/i;
  const trailingPhone = /\s+\d{9,12}$/;
  const kopoKopo = /\s+via\s+kopo\s+kopo.*$/i;

  let result = raw.replace(/\s+/g, ' ');
  let prev = '';
  // Iterate until stable (handles chained suffixes like "MERCHANT on 22/04/26 on 22/04/26")
  while (prev !== result) {
    prev = result;
    result = result
      .replace(suffixes, '')
      .replace(accountRef, '')
      .replace(trailingPhone, '')
      .replace(kopoKopo, '')
      .trim();
  }
  return result.length >= 2 ? result : null;
}

function defaultMerchantForType(type: string): string | null {
  switch (type) {
    case 'DEPOSIT': return 'Cash Deposit';
    case 'AIRTIME': return 'Airtime Purchase';
    case 'WITHDRAWN': return 'ATM Withdrawal';
    case 'MSHWARI_LOAN': return 'M-Shwari Loan';
    case 'MSHWARI_SAVINGS': return 'M-Shwari Savings';
    case 'KCB_LOAN': return 'KCB M-PESA Loan';
    case 'KCB_SAVINGS': return 'KCB M-PESA Savings';
    case 'POCHI_LA_BIASHARA': return 'Pochi la Biashara';
    default: return null;
  }
}

// ── Stage-specific regexes ─────────────────────────────────────────────────

const FULIZA_OUTSTANDING_RE = /Total Fuliza M-PESA outstanding amount is\s*(?:Ksh|KES)\s?([\d,]+(?:\.\d{1,2})?)/i;
const FULIZA_AVAILABLE_LIMIT_RE = /(?:fuliza|m-pesa)[\s\w]*(?:available\s+)?limit\s*(?:is|:|of)\s*(?:Ksh|KES)?\s?([\d,]+(?:\.\d{1,2})?)/i;
const FULIZA_FEE_RE = /(?:access fee charged|access fee\s*(?:is)?)\s*(?:Ksh|KES)\s?([\d,]+(?:\.\d{1,2})?)/i;
const BALANCE_RE = /(?:new\s+)?M-PESA\s+balance\s+(?:is\s+)?(?:Ksh|KES)\s?([\d,]+(?:\.\d{1,2})?)/i;
const TRANSACTION_COST_RE = /(?:transaction\s+(?:cost|fee)\s+(?:was\s+|is\s+)?|charged\s+)(?:Ksh|KES)\s?([\d,]+(?:\.\d{1,2})?)/i;
const DATE_RE = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
const DATE_ONLY_RE = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;

// ── Main parser ───────────────────────────────────────────────────────────

export function parseMpesaSms(raw: string): ParsedMpesa {
  try {
    const normalized = raw.replace(/\s+/g, ' ').trim();

    if (!isMpesaSms(normalized)) {
      return {
        code: null, amount: null, merchant: null, type: 'UNKNOWN',
        confidence: 'LOW', detectionPhase: 'NONE', smsDate: null,
        balance: null, transactionCost: null, fulizaOutstanding: null, fulizaAvailableLimit: null, fulizaFee: null,
      };
    }

    if (isFulizaServiceNotice(normalized)) {
      return {
        code: null, amount: null, merchant: null, type: 'UNKNOWN',
        confidence: 'LOW', detectionPhase: 'NONE', smsDate: null,
        balance: null, transactionCost: null, fulizaOutstanding: null, fulizaAvailableLimit: null, fulizaFee: null,
      };
    }

    // Stage 1: M-Pesa code — must contain at least one letter (excludes phone numbers)
    const codeMatch = normalized.match(/\b([A-Z0-9]{10})\b/i);
    const code = codeMatch && /[A-Z]/i.test(codeMatch[1]) ? codeMatch[1] : null;

    // Stage 2: Pre-detect special product types that need context-sensitive amount extraction
    const isMshwariLoan = /\bloan\s+from\s+m-shwari\b/i.test(normalized) || /\bm-shwari\s+loan\b/i.test(normalized);
    const isKcbLoan = /\bkcb\s+m-pesa\s+loan\b/i.test(normalized) || /\bloan\s+disbursed.*\bkcb\b/i.test(normalized) || /\bkcb\s+m-pesa.*\bloan\b/i.test(normalized);
    const isFulizaCharge = /\bfuliza\b.*\baccess\s+fee\b/i.test(normalized) || /Fuliza M-PESA amount is.*Access Fee charged/i.test(normalized);
    const isFulizaRepayment = /\bfuliza\b.*\brepayment\b/i.test(normalized) || /\byour\s+m-pesa\s+has\s+been\s+used\s+to\s+repay.*\bfuliza\b/i.test(normalized);

    // Stage 3: Amount extraction — strategy depends on detected type
    let rawAmount: number | null = null;

    if (isMshwariLoan || isKcbLoan) {
      // For loan disbursements: amount is the value BEFORE "loan from X"
      const loanAmountMatch = normalized.match(/(?:ksh|kes)[.\s]*([\d,]+(?:\.\d+)?)\s+loan\s+from\b/i);
      rawAmount = loanAmountMatch ? Number(loanAmountMatch[1].replace(/,/g, '')) : null;
    } else if (isFulizaCharge) {
      // For Fuliza charges: amount is the Fuliza transaction amount, NOT the largest
      const fulizaAmountMatch = normalized.match(/Fuliza M-PESA amount is\s*(?:Ksh|KES)[.\s]*([\d,]+(?:\.\d+)?)/i);
      rawAmount = fulizaAmountMatch ? Number(fulizaAmountMatch[1].replace(/,/g, '')) : null;
    } else if (isFulizaRepayment) {
      // For Fuliza repayments: amount is the repayment amount (before "to repay" or similar)
      const repayMatch = normalized.match(/(?:Ksh|KES)\s*([\d,]+(?:\.\d+)?)\s+(?:to\s+)?repay/i);
      rawAmount = repayMatch ? Number(repayMatch[1].replace(/,/g, '')) : null;
    }

    // Default: extract all Ksh amounts and pick the largest
    if (rawAmount === null) {
      const allAmountMatches = [...normalized.matchAll(/(?:ksh|kes)[.\s]*([\d,]+(?:\.\d+)?)/gi)];
      for (const m of allAmountMatches) {
        const candidate = Number(m[1].replace(/,/g, ''));
        if (candidate > 0 && (rawAmount === null || candidate > rawAmount)) {
          rawAmount = candidate;
        }
      }
    }
    const amount = rawAmount ?? null;

    // Stage 3: 3-phase classification — track matched rule for counterparty extraction
    let matchedRule: DetectionRule | null = null;
    let detectionPhase: ParsedMpesa['detectionPhase'] = 'NONE';

    for (const rule of DETECTION_RULES) {
      if (rule.primaryPatterns.some((re) => re.test(normalized))) {
        matchedRule = rule;
        detectionPhase = 'PRIMARY';
        break;
      }
    }

    if (!matchedRule) {
      for (const rule of DETECTION_RULES) {
        if (rule.fallbackPatterns.some((re) => re.test(normalized))) {
          matchedRule = rule;
          detectionPhase = 'FALLBACK';
          break;
        }
      }
    }

    if (!matchedRule) {
      for (const rule of DETECTION_RULES) {
        if (rule.lastResortPatterns.some((re) => re.test(normalized))) {
          matchedRule = rule;
          detectionPhase = 'LAST_RESORT';
          break;
        }
      }
    }

    const type: ParsedMpesa['type'] = matchedRule?.value ?? 'UNKNOWN';

    // Stage 4: Counterparty extraction using rule-specific patterns
    let merchant: string | null = null;
    for (const pattern of (matchedRule?.counterpartyPatterns ?? [])) {
      const match = normalized.match(pattern);
      if (match?.[1]) {
        merchant = cleanupMerchant(match[1]);
        if (merchant) break;
      }
    }
    merchant ??= defaultMerchantForType(type);

    // Stage 5: Balance + transaction cost + Fuliza enrichment
    const balance = (() => {
      const m = BALANCE_RE.exec(normalized);
      return m ? Number(m[1].replace(/,/g, '')) : null;
    })();

    const transactionCost = (() => {
      const m = TRANSACTION_COST_RE.exec(normalized);
      return m ? Number(m[1].replace(/,/g, '')) : null;
    })();

    const fulizaOutstanding = (() => {
      if (type !== 'FULIZA_CHARGE' && type !== 'FULIZA_BALANCE') return null;
      const m = FULIZA_OUTSTANDING_RE.exec(normalized);
      return m ? Number(m[1].replace(/,/g, '')) : null;
    })();

    const fulizaFee = (() => {
      if (type !== 'FULIZA_CHARGE') return null;
      const m = FULIZA_FEE_RE.exec(normalized);
      return m ? Number(m[1].replace(/,/g, '')) : null;
    })();

    const fulizaAvailableLimit = (() => {
      if (type !== 'FULIZA_REPAYMENT') return null;
      const m = FULIZA_AVAILABLE_LIMIT_RE.exec(normalized);
      return m ? Number(m[1].replace(/,/g, '')) : null;
    })();

    // Stage 6: Date extraction from SMS text
    const smsDate = (() => {
      const m = DATE_RE.exec(normalized);
      if (m) {
        let hour = parseInt(m[4], 10);
        const minute = parseInt(m[5], 10);
        let day = parseInt(m[1], 10);
        let month = parseInt(m[2], 10) - 1;
        let year = parseInt(m[3], 10);
        if (year < 100) year += 2000;

        const amPm = m[6]?.toUpperCase();
        if (amPm) {
          if (amPm === 'PM' && hour < 12) hour += 12;
          if (amPm === 'AM' && hour === 12) hour = 0;
        } else {
          hour = hour === 24 ? 0 : hour;
        }

        const d = new Date(year, month, day, hour, minute);
        return isNaN(d.getTime()) ? null : d.getTime();
      }
      const dm = DATE_ONLY_RE.exec(normalized);
      if (dm) {
        let day = parseInt(dm[1], 10);
        let month = parseInt(dm[2], 10) - 1;
        let year = parseInt(dm[3], 10);
        if (year < 100) year += 2000;
        const d = new Date(year, month, day, 12, 0);
        return isNaN(d.getTime()) ? null : d.getTime();
      }
      return null;
    })();

    // Confidence: PRIMARY + code + amount → HIGH; FALLBACK → MEDIUM; LAST_RESORT or nothing → LOW
    const confidence: MpesaConfidence =
      code && amount && detectionPhase === 'PRIMARY' ? 'HIGH'
        : amount && detectionPhase === 'FALLBACK' ? 'MEDIUM'
        : amount && code && detectionPhase === 'LAST_RESORT' ? 'MEDIUM'
        : 'LOW';

    return {
      code,
      amount,
      merchant,
      type,
      confidence,
      detectionPhase,
      smsDate,
      balance,
      transactionCost,
      fulizaOutstanding,
      fulizaAvailableLimit,
      fulizaFee,
    };
  } catch {
    return {
      code: null, amount: null, merchant: null, type: 'UNKNOWN',
      confidence: 'LOW', detectionPhase: 'NONE', smsDate: null,
      balance: null, transactionCost: null, fulizaOutstanding: null, fulizaAvailableLimit: null, fulizaFee: null,
    };
  }
}