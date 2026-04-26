import { describe, expect, it } from 'vitest';

import { compareVersions } from './version-utils';

describe('compareVersions', () => {
  it('compares semantic versions correctly', () => {
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.1', '1.2.0')).toBe(1);
    expect(compareVersions('1.1.9', '1.2.0')).toBe(-1);
  });

  it('handles missing patch parts', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.1')).toBe(-1);
  });
});
