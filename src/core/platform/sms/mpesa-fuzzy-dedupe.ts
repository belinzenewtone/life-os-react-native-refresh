import { levenshtein } from './levenshtein';

const BUSINESS_SUFFIXES = /\b(?:LTD|LIMITED|INC|PLC|CO|CORP|LLC|LLP|SACO|GBC)\.?\s*$/i;

function normalizeForComparison(name: string): string {
  return name.trim().toUpperCase().replace(BUSINESS_SUFFIXES, '').trim();
}

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