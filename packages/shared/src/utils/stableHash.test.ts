import { describe, expect, it } from 'bun:test';
import { stableHash } from '@template/shared/utils';

describe('stableHash', () => {
  it('is independent of key order', () => {
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }));
  });

  it('is independent of nested key order', () => {
    expect(stableHash({ x: { a: 1, b: 2 } })).toBe(stableHash({ x: { b: 2, a: 1 } }));
  });

  it('changes when a value changes', () => {
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
  });

  it('treats an undefined value as absent', () => {
    expect(stableHash({ a: undefined })).toBe(stableHash({}));
  });

  it('returns a short hex digest', () => {
    expect(stableHash({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
  });
});
