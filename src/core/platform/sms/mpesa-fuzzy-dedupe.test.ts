import { describe, expect, it } from 'vitest';
import { isNearDuplicateMerchant } from './mpesa-fuzzy-dedupe';

describe('isNearDuplicateMerchant', () => {
  it('returns true for exact match', () => {
    expect(isNearDuplicateMerchant('ARTISAN COFFEE', 'ARTISAN COFFEE')).toBe(true);
  });

  it('returns true for single-character typo', () => {
    expect(isNearDuplicateMerchant('ARTISAN COFFEE', 'ARTISAN COFEE')).toBe(true);
  });

  it('returns true for case-insensitive match', () => {
    expect(isNearDuplicateMerchant('Java House', 'JAVA HOUSE')).toBe(true);
  });

  it('returns true for trailing whitespace', () => {
    expect(isNearDuplicateMerchant('KPLC PREPAID', 'KPLC PREPAID ')).toBe(true);
  });

  it('returns false for completely different merchants', () => {
    expect(isNearDuplicateMerchant('KPLC PREPAID', 'JAVA HOUSE')).toBe(false);
  });

  it('returns false for similar but different merchants (below threshold)', () => {
    expect(isNearDuplicateMerchant('NAIVAS', 'NAIRA')).toBe(false);
  });

  it('returns true for merchants differing only in LTD suffix', () => {
    expect(isNearDuplicateMerchant('SAFARICOM', 'SAFARICOM LTD')).toBe(true);
  });

  it('handles null inputs safely', () => {
    expect(isNearDuplicateMerchant(null, 'MERCHANT')).toBe(false);
    expect(isNearDuplicateMerchant('MERCHANT', null)).toBe(false);
    expect(isNearDuplicateMerchant(null, null)).toBe(false);
  });

  it('uses percentage-based threshold for longer names', () => {
    expect(isNearDuplicateMerchant('ARTISAN COFFEE ROASTERS', 'ARTISAN COFFEE ROASTER')).toBe(true);
  });
});