/**
 * Semantic Hash Engine
 *
 * Generates deterministic hashes for cross-device deduplication of M-Pesa transactions.
 * Unlike source_hash (which is SHA-256 of the raw SMS), semantic_hash is based on
 * normalized transaction attributes: amount, date, and merchant.
 *
 * This allows the same transaction to be detected as a duplicate even when:
 *   - Received on different devices (different SMS formatting)
 *   - Processed at different times (different timestamps)
 *   - With slightly different raw text (carrier prefixes, whitespace)
 *
 * Normalization rules:
 *   - Amount: rounded to 2 decimal places
 *   - Date: yyyyMMdd only (time-agnostic)
 *   - Merchant: lowercased, trimmed, common suffixes removed
 */

import * as Crypto from 'expo-crypto';

export type SemanticHashInput = {
  amount: number | null;
  date: number | null; // Unix timestamp ms
  merchant: string | null;
};

function normalizeMerchant(merchant: string | null): string {
  if (!merchant) return '';
  return merchant
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b(?:ltd|limited|inc|plc|co|corp|llc|llp|saco|gbc)\.?\s*$/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

function formatDate(dateMs: number | null): string {
  if (!dateMs) return '';
  const d = new Date(dateMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function formatAmount(amount: number | null): string {
  if (amount == null) return '';
  return amount.toFixed(2);
}

export class SemanticHashEngine {
  /**
   * Generates a semantic hash string from normalized transaction attributes.
   * This is the raw canonical string before hashing.
   */
  static canonicalize(input: SemanticHashInput): string {
    const parts = [
      'TRANSACTION',
      formatAmount(input.amount),
      formatDate(input.date),
      normalizeMerchant(input.merchant),
    ];
    return parts.join('|');
  }

  /**
   * Computes the SHA-256 semantic hash for deduplication.
   */
  static async compute(input: SemanticHashInput): Promise<string> {
    const canonical = this.canonicalize(input);
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
  }

  /**
   * Fast equality check without hashing (for in-memory comparison).
   */
  static isEqual(a: SemanticHashInput, b: SemanticHashInput): boolean {
    return this.canonicalize(a) === this.canonicalize(b);
  }
}
