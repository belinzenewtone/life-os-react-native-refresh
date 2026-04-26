import { describe, expect, it } from 'vitest';

import { buildDedupeKeys, isDuplicate } from './mpesa-dedupe';

describe('mpesa dedupe', () => {
  it('builds only truthy dedupe keys', () => {
    const keys = buildDedupeKeys({
      mpesaCode: 'QAB123CDE4',
      sourceHash: null,
      semanticHash: 'semantic-123',
    });

    expect(keys).toEqual(['QAB123CDE4', 'semantic-123']);
  });

  it('detects duplicate when any key already exists', () => {
    const existing = new Set(['semantic-123', 'another']);
    const duplicate = isDuplicate(existing, ['new-key', 'semantic-123']);
    expect(duplicate).toBe(true);
  });

  it('does not mark duplicate when keys do not overlap', () => {
    const existing = new Set(['old-1', 'old-2']);
    const duplicate = isDuplicate(existing, ['new-1', 'new-2']);
    expect(duplicate).toBe(false);
  });

  it('handles empty key arrays', () => {
    const keys = buildDedupeKeys({
      mpesaCode: null,
      sourceHash: null,
      semanticHash: null,
    });
    expect(keys).toEqual([]);
    expect(isDuplicate(new Set(), [])).toBe(false);
  });

  it('detects duplicate by mpesa code', () => {
    const existing = new Set(['QAB123CDE4']);
    const keys = buildDedupeKeys({ mpesaCode: 'QAB123CDE4', sourceHash: 'abc', semanticHash: 'def' });
    expect(isDuplicate(existing, keys)).toBe(true);
  });

  it('detects duplicate by semantic hash', () => {
    const existing = new Set(['hash-xyz']);
    const keys = buildDedupeKeys({ mpesaCode: null, sourceHash: null, semanticHash: 'hash-xyz' });
    expect(isDuplicate(existing, keys)).toBe(true);
  });

  it('detects duplicate by source hash', () => {
    const existing = new Set(['src-hash-abc']);
    const keys = buildDedupeKeys({ mpesaCode: null, sourceHash: 'src-hash-abc', semanticHash: 'sem-xyz' });
    expect(isDuplicate(existing, keys)).toBe(true);
  });

  it('handles null mpesaCode gracefully', () => {
    const keys = buildDedupeKeys({ mpesaCode: null, sourceHash: 'abc', semanticHash: 'def' });
    expect(keys).not.toContain('');
    expect(keys).toEqual(['abc', 'def']);
  });

  it('handles undefined values', () => {
    const keys = buildDedupeKeys({ mpesaCode: undefined as any, sourceHash: 'abc', semanticHash: null });
    expect(keys).toEqual(['abc']);
  });
});