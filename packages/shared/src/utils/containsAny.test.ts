import { describe, expect, it } from 'bun:test';
import { containsAny } from '@template/shared/utils';

describe('containsAny', () => {
  it('true when primitive arrays overlap', () => {
    expect(containsAny(['a', 'b'], ['b', 'c'])).toBe(true);
  });

  it('false when disjoint', () => {
    expect(containsAny(['a', 'b'], ['c', 'd'])).toBe(false);
  });

  it('false when either side is empty', () => {
    expect(containsAny([], ['a'])).toBe(false);
    expect(containsAny(['a'], [])).toBe(false);
  });

  it('accepts any iterable', () => {
    expect(containsAny(new Set([1, 2]), [2, 3])).toBe(true);
  });

  it('compares objects structurally by default', () => {
    expect(containsAny([{ id: 1 }], [{ id: 1 }])).toBe(true);
    expect(containsAny([{ id: 1 }], [{ id: 2 }])).toBe(false);
  });

  it('default object compare is key-order insensitive (sorted json)', () => {
    expect(containsAny([{ a: 1, b: 2 }], [{ b: 2, a: 1 }])).toBe(true);
  });

  it('honors a custom keyBy', () => {
    const a = [{ id: 1, name: 'x' }];
    const b = [{ id: 1, name: 'y' }];
    expect(containsAny(a, b, (o) => o.id)).toBe(true);
    expect(containsAny(a, b)).toBe(false);
  });
});
