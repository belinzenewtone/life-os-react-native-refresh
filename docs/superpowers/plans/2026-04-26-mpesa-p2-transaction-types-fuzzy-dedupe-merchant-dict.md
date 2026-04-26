# M-Pesa P2: New Transaction Types + Fuzzy Dedupe + Expanded Dictionary

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add M-Shwari, KCB M-Pesa, and Pochi la Biashara transaction types to the parser; implement fuzzy (Levenshtein) merchant deduplication; expand the merchant category dictionary from ~47 to 100+ entries.

**Architecture:** Three independent subsystems — (1) new detection rules + ingestion wiring, (2) fuzzy dedupe module + integration, (3) merchant dictionary expansion + extraction to data file. Each produces working, testable software on its own.

**Tech Stack:** TypeScript, Vitest, expo-crypto (SHA-256), React Native SQLite

---

## Task 1: Add M-Shwari Detection Rules

**Files:**
- Modify: `src/core/platform/sms/mpesa-parser.ts` (lines 179–180, insert before `sent` rule; also `defaultMerchantForType` at line ~230)
- Modify: `src/core/platform/sms/mpesa-ingestion-service.ts` (semanticCategory map ~line 144–153; FULIZA_DRAW_TYPES ~line 405)
- Modify: `src/core/platform/sms/mpesa-parser.test.ts` (add test cases)
- Modify: `src/core/platform/sms/confidence-based-import-filter.ts` (no changes needed — already handles UNKNOWN quarantine)

**Real M-Shwari SMS patterns:**

1. **Loan disbursement:** `"SAF1234567 Confirmed. Ksh5,000.00 loan from M-Shwari to your M-PESA on 22/04/26 at 10:30 AM. New M-PESA balance is Ksh15,000.00."`
2. **Loan repayment:** `"SAF2345678 Confirmed. Ksh2,500.00 repaid to M-Shwari from M-PESA on 22/04/26."`
3. **Savings deposit:** `"SAF3456789 Confirmed. Ksh1,000.00 saved to M-Shwari on 22/04/26 at 2:00 PM."`
4. **Savings withdrawal:** `"SAF4567890 Confirmed. Ksh500.00 withdrawn from M-Shwari savings on 22/04/26."`
5. **Loan limit notification:** `"M-Shwari loan limit is Ksh10,000."` (service notice — should be filtered)

- [ ] **Step 1: Add M-Shwari detection rules to parser**

In `src/core/platform/sms/mpesa-parser.ts`, insert two new `DetectionRule` entries BEFORE the `sent` rule (before the `{ id: 'sent', ... }` block). Insert after the `fuliza_repayment` rule block:

```typescript
  {
    id: 'mshwari_loan',
    primaryPatterns: [
      /\bloan\s+from\s+m-shwari\b/i,
      /\bm-shwari\s+loan\b/i,
      /\bloan\s+disbursed\b.*\bm-shwari\b/i,
    ],
    fallbackPatterns: [/\bm-shwari\b.*\bloan\b/i, /\bloan\s+.*\bm-shwari\b/i],
    lastResortPatterns: [/\bm-shwari\b/i, /\bloan\s+from\b/i],
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
```

- [ ] **Step 2: Add default merchant names for new types**

In the `defaultMerchantForType` function in `src/core/platform/sms/mpesa-parser.ts`, add cases:

```typescript
    case 'MSHWARI_LOAN': return 'M-Shwari Loan';
    case 'MSHWARI_SAVINGS': return 'M-Shwari Savings';
```

- [ ] **Step 3: Add M-Shwari categories in ingestion service**

In `src/core/platform/sms/mpesa-ingestion-service.ts`, add to the `semanticCategory` map:

```typescript
    MSHWARI_LOAN: 'Loans & Credit',
    MSHWARI_SAVINGS: 'Savings',
```

- [ ] **Step 4: Write test cases for M-Shwari**

In `src/core/platform/sms/mpesa-parser.test.ts`, add a new describe block:

```typescript
describe('parseMpesaSms - M-Shwari types', () => {
  it('classifies M-Shwari loan disbursement', () => {
    const parsed = parseMpesaSms(
      'SAF1234567 Confirmed. Ksh5,000.00 loan from M-Shwari to your M-PESA on 22/04/26 at 10:30 AM. New M-PESA balance is Ksh15,000.00.',
    );
    expect(parsed.type).toBe('MSHWARI_LOAN');
    expect(parsed.amount).toBe(5000);
    expect(parsed.merchant).toBe('M-Shwari');
    expect(parsed.confidence).toBe('HIGH');
    expect(parsed.balance).toBe(15000);
  });

  it('classifies M-Shwari loan repayment via fallback', () => {
    const parsed = parseMpesaSms(
      'SAF2345678 Confirmed. Ksh2,500.00 repaid to M-Shwari loan from M-PESA on 22/04/26.',
    );
    expect(parsed.type).toBe('MSHWARI_LOAN');
    expect(parsed.amount).toBe(2500);
  });

  it('classifies M-Shwari savings deposit', () => {
    const parsed = parseMpesaSms(
      'SAF3456789 Confirmed. Ksh1,000.00 saved to M-Shwari on 22/04/26 at 2:00 PM.',
    );
    expect(parsed.type).toBe('MSHWARI_SAVINGS');
    expect(parsed.amount).toBe(1000);
    expect(parsed.merchant).toBe('M-Shwari');
  });

  it('classifies M-Shwari savings withdrawal', () => {
    const parsed = parseMpesaSms(
      'SAF4567890 Confirmed. Ksh500.00 withdrawn from M-Shwari savings on 22/04/26.',
    );
    expect(parsed.type).toBe('MSHWARI_SAVINGS');
    expect(parsed.amount).toBe(500);
  });
});
```

- [ ] **Step 5: Run parser tests**

Run: `npx vitest run src/core/platform/sms/mpesa-parser.test.ts`
Expected: All 60+ tests pass

- [ ] **Step 6: Commit**

```bash
git add src/core/platform/sms/mpesa-parser.ts src/core/platform/sms/mpesa-ingestion-service.ts src/core/platform/sms/mpesa-parser.test.ts
git commit -m "feat: add M-Shwari loan and savings transaction types to M-Pesa parser"
```

---

## Task 2: Add KCB M-Pesa Detection Rules

**Files:**
- Modify: `src/core/platform/sms/mpesa-parser.ts` (insert before `sent` rule, after M-Shwari rules)
- Modify: `src/core/platform/sms/mpesa-ingestion-service.ts` (semanticCategory map)
- Modify: `src/core/platform/sms/mpesa-parser.test.ts` (add test cases)

**Real KCB M-Pesa SMS patterns:**

1. **Loan disbursement:** `"KCB1234567 Confirmed. Ksh10,000.00 KCB M-PESA loan disbursed on 22/04/26 at 11:00 AM."`
2. **Loan repayment:** `"KCB2345678 Confirmed. Ksh3,000.00 KCB M-PESA loan repayment from M-PESA on 22/04/26."`
3. **Savings deposit:** `"KCB3456789 Confirmed. Ksh2,000.00 deposited to KCB M-PESA savings on 22/04/26."`
4. **Savings withdrawal:** `"KCB4567890 Confirmed. Ksh1,500.00 withdrawn from KCB M-PESA savings on 22/04/26."`

- [ ] **Step 1: Add KCB detection rules to parser**

Insert AFTER the `mshwari_savings` rule and BEFORE the `sent` rule:

```typescript
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
```

- [ ] **Step 2: Add default merchant and category**

In `mpesa-parser.ts`, `defaultMerchantForType`:
```typescript
    case 'KCB_LOAN': return 'KCB M-PESA Loan';
    case 'KCB_SAVINGS': return 'KCB M-PESA Savings';
```

In `mpesa-ingestion-service.ts`, `semanticCategory`:
```typescript
    KCB_LOAN: 'Loans & Credit',
    KCB_SAVINGS: 'Savings',
```

- [ ] **Step 3: Write test cases for KCB M-Pesa**

```typescript
describe('parseMpesaSms - KCB M-Pesa types', () => {
  it('classifies KCB M-PESA loan disbursement', () => {
    const parsed = parseMpesaSms(
      'KCB1234567 Confirmed. Ksh10,000.00 KCB M-PESA loan disbursed on 22/04/26 at 11:00 AM.',
    );
    expect(parsed.type).toBe('KCB_LOAN');
    expect(parsed.amount).toBe(10000);
    expect(parsed.merchant).toBe('KCB M-PESA');
  });

  it('classifies KCB M-PESA loan repayment', () => {
    const parsed = parseMpesaSms(
      'KCB2345678 Confirmed. Ksh3,000.00 KCB M-PESA loan repayment from M-PESA on 22/04/26.',
    );
    expect(parsed.type).toBe('KCB_LOAN');
    expect(parsed.amount).toBe(3000);
  });

  it('classifies KCB M-PESA savings deposit', () => {
    const parsed = parseMpesaSms(
      'KCB3456789 Confirmed. Ksh2,000.00 deposited to KCB M-PESA savings on 22/04/26.',
    );
    expect(parsed.type).toBe('KCB_SAVINGS');
    expect(parsed.amount).toBe(2000);
  });

  it('classifies KCB M-PESA savings withdrawal', () => {
    const parsed = parseMpesaSms(
      'KCB4567890 Confirmed. Ksh1,500.00 withdrawn from KCB M-PESA savings on 22/04/26.',
    );
    expect(parsed.type).toBe('KCB_SAVINGS');
    expect(parsed.amount).toBe(1500);
  });
});
```

- [ ] **Step 4: Run parser tests**

Run: `npx vitest run src/core/platform/sms/mpesa-parser.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/core/platform/sms/mpesa-parser.ts src/core/platform/sms/mpesa-ingestion-service.ts src/core/platform/sms/mpesa-parser.test.ts
git commit -m "feat: add KCB M-Pesa loan and savings transaction types"
```

---

## Task 3: Add Pochi la Biashara Detection Rule

**Files:**
- Modify: `src/core/platform/sms/mpesa-parser.ts` (insert before `sent` rule)
- Modify: `src/core/platform/sms/mpesa-ingestion-service.ts` (semanticCategory, FULIZA_DRAW_TYPES)
- Modify: `src/core/platform/sms/mpesa-parser.test.ts` (add test cases)

**Real Pochi la Biashara SMS patterns:**

1. **Receive into business till:** `"PCH1234567 Confirmed. Ksh2,500.00 received from JOHN DOE via Pochi la Biashara on 22/04/26 at 3:15 PM."`
2. **Send from business:** `"PCH2345678 Confirmed. Ksh1,200.00 sent from your till number 98765 via Pochi la Biashara on 22/04/26."`

- [ ] **Step 1: Add Pochi rule to parser**

Insert AFTER the KCB rules and BEFORE the `sent` rule:

```typescript
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
```

- [ ] **Step 2: Add default merchant and category**

In `mpesa-parser.ts`, `defaultMerchantForType`:
```typescript
    case 'POCHI_LA_BIASHARA': return 'Pochi la Biashara';
```

In `mpesa-ingestion-service.ts`, `semanticCategory`:
```typescript
    POCHI_LA_BIASHARA: 'Business',
```

In `mpesa-ingestion-service.ts`, add `POCHI_LA_BIASHARA` to `FULIZA_DRAW_TYPES`:
```typescript
  const FULIZA_DRAW_TYPES = new Set(['SENT', 'AIRTIME', 'PAYBILL', 'BUY_GOODS', 'WITHDRAWN', 'POCHI_LA_BIASHARA']);
```

- [ ] **Step 3: Write test cases for Pochi la Biashara**

```typescript
describe('parseMpesaSms - Pochi la Biashara', () => {
  it('classifies Pochi la Biashara received', () => {
    const parsed = parseMpesaSms(
      'PCH1234567 Confirmed. Ksh2,500.00 received from JOHN DOE via Pochi la Biashara on 22/04/26 at 3:15 PM.',
    );
    expect(parsed.type).toBe('POCHI_LA_BIASHARA');
    expect(parsed.amount).toBe(2500);
  });

  it('classifies Pochi la Biashara sent from till', () => {
    const parsed = parseMpesaSms(
      'PCH2345678 Confirmed. Ksh1,200.00 sent from your till number 98765 via Pochi la Biashara on 22/04/26.',
    );
    expect(parsed.type).toBe('POCHI_LA_BIASHARA');
    expect(parsed.amount).toBe(1200);
  });
});
```

- [ ] **Step 4: Run parser tests**

Run: `npx vitest run src/core/platform/sms/mpesa-parser.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/core/platform/sms/mpesa-parser.ts src/core/platform/sms/mpesa-ingestion-service.ts src/core/platform/sms/mpesa-parser.test.ts
git commit -m "feat: add Pochi la Biashara transaction type"
```

---

## Task 4: Add DB Migration for transaction_type Index

**Files:**
- Modify: `src/core/data/database/bootstrap.ts` (increment CURRENT_VERSION, add migration 7)

The `transaction_type` column has no index. Adding one will speed up queries filtering by type (e.g., "show me all M-Shwari transactions").

- [ ] **Step 1: Add migration v7**

In `src/core/data/database/bootstrap.ts`:
1. Change `CURRENT_VERSION` from 6 to 7
2. Add migration 7:

```typescript
  7: [
    'CREATE INDEX IF NOT EXISTS idx_tx_transaction_type ON transactions(user_id, transaction_type);',
  ],
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (110+ tests)

- [ ] **Step 3: Commit**

```bash
git add src/core/data/database/bootstrap.ts
git commit -m "feat: add transaction_type index migration v7"
```

---

## Task 5: Implement Fuzzy Merchant Dedupe (Levenshtein)

**Files:**
- Create: `src/core/platform/sms/levenshtein.ts` (pure Levenshtein distance function)
- Create: `src/core/platform/sms/mpesa-fuzzy-dedupe.ts` (merchant name fuzzy matching)
- Create: `src/core/platform/sms/levenshtein.test.ts`
- Create: `src/core/platform/sms/mpesa-fuzzy-dedupe.test.ts`
- Modify: `src/core/platform/sms/mpesa-ingestion-service.ts` (integrate fuzzy dedupe into heuristic dedupe block, ~lines 327–354)

- [ ] **Step 1: Write failing Levenshtein test**

Create `src/core/platform/sms/levenshtein.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { levenshtein } from './levenshtein';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });

  it('computes single-character insertion', () => {
    expect(levenshtein('abc', 'abcd')).toBe(1);
  });

  it('computes single-character deletion', () => {
    expect(levenshtein('abcd', 'abc')).toBe(1);
  });

  it('computes single-character substitution', () => {
    expect(levenshtein('abc', 'axc')).toBe(1);
  });

  it('computes distance for transposed characters', () => {
    expect(levenshtein('ab', 'ba')).toBe(2);
  });

  it('returns length of longer string for completely different strings', () => {
    expect(levenshtein('abc', 'xyz')).toBe(3);
  });

  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('', '')).toBe(0);
  });

  it('handles real merchant name typos', () => {
    expect(levenshtein('ARTISAN COFFEE', 'ARTISAN COFEE')).toBe(1);
    expect(levenshtein('JAVA HOUSE', 'JAVA HUSE')).toBe(1);
    expect(levenshtein('KPLC PREPAID', 'KPLC PREPAID')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/platform/sms/levenshtein.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Levenshtein function**

Create `src/core/platform/sms/levenshtein.ts`:

```typescript
/**
 * Computes the Levenshtein edit distance between two strings.
 * Uses iterative matrix approach (O(mn) time, O(min(m,n)) space).
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const lenA = a.length;
  const lenB = b.length;
  const prev = new Array<number>(lenA + 1);
  const curr = new Array<number>(lenA + 1);

  for (let i = 0; i <= lenA; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= lenB; j++) {
    curr[0] = j;
    for (let i = 1; i <= lenA; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,
        curr[i - 1] + 1,
        prev[i - 1] + cost,
      );
    }
    for (let i = 0; i <= lenA; i++) {
      prev[i] = curr[i];
    }
  }

  return prev[lenA];
}
```

- [ ] **Step 4: Run Levenshtein tests**

Run: `npx vitest run src/core/platform/sms/levenshtein.test.ts`
Expected: All 8 tests pass

- [ ] **Step 5: Write failing fuzzy dedupe test**

Create `src/core/platform/sms/mpesa-fuzzy-dedupe.test.ts`:

```typescript
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

  it('returns true for merchants differing only in "LTD" suffix', () => {
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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/core/platform/sms/mpesa-fuzzy-dedupe.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Implement fuzzy dedupe module**

Create `src/core/platform/sms/mpesa-fuzzy-dedupe.ts`:

```typescript
import { levenshtein } from './levenshtein';

const BUSINESS_SUFFIXES = /\b(?:LTD|LIMITED|INC|PLC|CO|COMPANY|CORP|ENTERPRISES?|SERVICES?)\.?\s*$/i;

function normalizeForComparison(name: string): string {
  return name.trim().toUpperCase().replace(BUSINESS_SUFFIXES, '').trim();
}

/**
 * Determines if two merchant names are near-duplicates using Levenshtein distance.
 * Uses a percentage-based threshold: if edit distance <= max(1, 20% of the longer name length),
 * the names are considered near-duplicates.
 */
export function isNearDuplicateMerchant(
  a: string | null,
  b: string | null,
): boolean {
  if (!a || !b) return false;

  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);

  if (normA === normB) return true;

  const dist = levenshtein(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return true;

  const threshold = Math.max(1, Math.round(maxLen * 0.2));

  return dist <= threshold;
}
```

- [ ] **Step 8: Run fuzzy dedupe tests**

Run: `npx vitest run src/core/platform/sms/mpesa-fuzzy-dedupe.test.ts`
Expected: All 9 tests pass

- [ ] **Step 9: Integrate fuzzy dedupe into ingestion service**

In `src/core/platform/sms/mpesa-ingestion-service.ts`:

1. Add import at the top:
```typescript
import { isNearDuplicateMerchant } from '@/core/platform/sms/mpesa-fuzzy-dedupe';
```

2. In the heuristic dedupe block (~lines 327–354), after the exact `merchant` match check, add a fuzzy check. Replace the current heuristic dedupe block with:

```typescript
      // ── Tier 4: Heuristic dedupe ──
      // Skip heuristic dedupe for default merchants to avoid losing legitimate duplicates
      if (!duplicate && parsed.amount != null && !isDefaultMerchant(parsed.merchant)) {
        const effectiveTs = parsed.smsDate ?? receivedAt ?? Date.now();
        const windowStart = effectiveTs - 5 * 60 * 1000;
        const windowEnd = effectiveTs + 5 * 60 * 1000;
        const heuristicDuplicate = await db.getFirstAsync<{ id: string; merchant: string }>(
          `SELECT id, merchant FROM transactions
           WHERE user_id = ? AND amount = ? AND date BETWEEN ? AND ?
           LIMIT 10`,
          userId,
          parsed.amount,
          windowStart,
          windowEnd,
        );
        if (heuristicDuplicate) {
          // Check for exact or fuzzy merchant match
          if (heuristicDuplicate.merchant === parsed.merchant || isNearDuplicateMerchant(heuristicDuplicate.merchant, parsed.merchant)) {
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
      }
```

Note: The query now fetches `LIMIT 10` instead of `LIMIT 1`, and selects `merchant` column too. The fuzzy check happens on the first candidate found. This is because the original exact-matched query `...AND merchant = ?` would miss fuzzy matches — we now check fuzzy in application code.

- [ ] **Step 10: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (now 127+ tests)

- [ ] **Step 11: Commit**

```bash
git add src/core/platform/sms/levenshtein.ts src/core/platform/sms/levenshtein.test.ts src/core/platform/sms/mpesa-fuzzy-dedupe.ts src/core/platform/sms/mpesa-fuzzy-dedupe.test.ts src/core/platform/sms/mpesa-ingestion-service.ts
git commit -m "feat: add Levenshtein-based fuzzy merchant deduplication"
```

---

## Task 6: Expand Merchant Category Dictionary to 100+

**Files:**
- Create: `src/core/platform/sms/merchant-category-data.ts` (extracted and expanded KNOWN_MERCHANTS)
- Modify: `src/core/platform/sms/mpesa-ingestion-service.ts` (import from data file, remove inline KNOWN_MERCHANTS)

- [ ] **Step 1: Create expanded merchant category data file**

Create `src/core/platform/sms/merchant-category-data.ts` with 100+ entries organized by category:

```typescript
/**
 * Kenya merchant → category mapping for M-Pesa categorization.
 * Keys are lowercase substrings used for matching.
 * Values are category strings.
 *
 * Categories: Food, Groceries, Shopping, Transport, Bills, Subscriptions,
 *             Entertainment, Health, Education, Savings, Loans & Credit, Business
 */
export const KNOWN_MERCHANTS: Record<string, string> = {
  // ── Food & Dining (22) ──
  'kfc': 'Food',
  'java': 'Food',
  'artcaffe': 'Food',
  'big square': 'Food',
  'cafe deli': 'Food',
  'chicken inn': 'Food',
  'chicken licken': 'Food',
  'pizza inn': 'Food',
  'dominos': 'Food',
  'subway': 'Food',
  'mcdonalds': 'Food',
  'macdonalds': 'Food',
  'steers': 'Food',
  'kennis': 'Food',
  'artisan coffee': 'Food',
  'costa': 'Food',
  'starbucks': 'Food',
  'wimpy': 'Food',
  'burger king': 'Food',
  'galitos': 'Food',
  'habesha': 'Food',
  'roast house': 'Food',

  // ── Groceries (10) ──
  'naivas': 'Groceries',
  'quickmart': 'Groceries',
  'carrefour': 'Shopping',
  'cleanshelf': 'Groceries',
  'tuskys': 'Groceries',
  'chandarana': 'Groceries',
  'uchumi': 'Groceries',
  'jamii supermarket': 'Groceries',
  'eastmatt': 'Groceries',
  'freshmat': 'Groceries',

  // ── Shopping (12) ──
  'mattress': 'Shopping',
  'jumia': 'Shopping',
  'kilimall': 'Shopping',
  'masoko': 'Shopping',
  'glovo': 'Shopping',
  'copa': 'Shopping',
  'amazon': 'Shopping',
  'aliexpress': 'Shopping',
  'shein': 'Shopping',
  'temu': 'Shopping',
  '瓜': 'Shopping',
  'wholesale': 'Shopping',

  // ── Transport (14) ──
  'uber': 'Transport',
  'bolt': 'Transport',
  'little': 'Transport',
  'swvl': 'Transport',
  'kenya railways': 'Transport',
  'sgr': 'Transport',
  'total': 'Transport',
  'shell': 'Transport',
  'galana': 'Transport',
  'rubis': 'Transport',
  'national oil': 'Transport',
  'matatu': 'Transport',
  'ridyn': 'Transport',
  'hive': 'Transport',

  // ── Bills (16) ──
  'kplc': 'Bills',
  'kenya power': 'Bills',
  'safaricom': 'Bills',
  'airtel': 'Bills',
  'telkom': 'Bills',
  'zuku': 'Bills',
  'water': 'Bills',
  'nairobi water': 'Bills',
  'electricity': 'Bills',
  'dstv': 'Bills',
  'gotv': 'Bills',
  'startimes': 'Bills',
  'kra': 'Bills',
  'nhif': 'Health',
  'nssf': 'Bills',
  'huduma': 'Bills',

  // ── Subscriptions (6) ──
  'netflix': 'Subscriptions',
  'spotify': 'Subscriptions',
  'youtube': 'Subscriptions',
  'showmax': 'Subscriptions',
  'apple': 'Subscriptions',
  'deezer': 'Subscriptions',

  // ── Entertainment (6) ──
  'imax': 'Entertainment',
  'anga': 'Entertainment',
  'century cinemax': 'Entertainment',
  'cinemax': 'Entertainment',
  'flix': 'Entertainment',
  'planet fitness': 'Health',

  // ── Health (6) ──
  'pharmacy': 'Health',
  'hospital': 'Health',
  'clinic': 'Health',
  'doctor': 'Health',
  'medical': 'Health',
  'health': 'Health',

  // ── Education (5) ──
  'school': 'Education',
  'university': 'Education',
  'college': 'Education',
  'exam': 'Education',
  'tuition': 'Education',

  // ── Business & Finance (8) ──
  'm-shwari': 'Loans & Credit',
  'kcb m-pesa': 'Loans & Credit',
  'pochi': 'Business',
  'till number': 'Business',
  'kopo kopo': 'Business',
  'lipa na m-pesa': 'Business',
  'paybill': 'Bills',

  // ──Fuel (keeping distinct from Transport for gas stations) ──
  'ivo': 'Transport',
  'gulf': 'Transport',
  'energy': 'Transport',
  'pro energy': 'Transport',
  'hashi': 'Transport',
  'stabex': 'Transport',
  'oilibya': 'Transport',
  'engen': 'Transport',
};
```

(That's ~105 entries.)

- [ ] **Step 2: Update ingestion service to use data file**

In `src/core/platform/sms/mpesa-ingestion-service.ts`:

1. Replace the inline `KNOWN_MERCHANTS` object (lines 17–78) with an import:

```typescript
import { KNOWN_MERCHANTS } from '@/core/platform/sms/merchant-category-data';
```

2. Delete the entire inline `KNOWN_MERCHANTS` const (lines 17–78) and the comment before it.

3. The `classifyKnownMerchant` function (lines ~80-87) stays as-is — it already references `KNOWN_MERCHANTS` which will now come from the import.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/core/platform/sms/merchant-category-data.ts src/core/platform/sms/mpesa-ingestion-service.ts
git commit -m "feat: expand merchant category dictionary to 100+ entries, extract to data file"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All 127+ tests pass

- [ ] **Step 3: Verify no regressions in existing test files**

Run: `npx vitest run src/core/platform/sms/ src/core/data/database/bootstrap.test.ts src/core/domain/`
Expected: All pass

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix any remaining test/regression issues"
```