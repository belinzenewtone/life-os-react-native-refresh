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