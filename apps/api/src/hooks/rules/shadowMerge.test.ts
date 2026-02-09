import { describe, expect, it } from 'bun:test';
import { shadowMerge } from '#/hooks/rules/shadowMerge';

describe('shadowMerge', () => {
  describe('basic merging', () => {
    it('merges data onto previous record', () => {
      const result = shadowMerge({ a: 1, b: 2 }, { b: 3, c: 4 });
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('handles undefined previous', () => {
      const result = shadowMerge(undefined, { a: 1 });
      expect(result).toEqual({ a: 1 });
    });

    it('does not mutate previous record', () => {
      const previous = { a: 1, nested: { x: 10 } };
      const result = shadowMerge(previous, { b: 2 });
      expect(previous).toEqual({ a: 1, nested: { x: 10 } });
      expect(result).not.toBe(previous);
    });

    it('deep clones nested objects', () => {
      const previous = { nested: { x: 10 } };
      const result = shadowMerge(previous, { other: 1 });
      expect(result.nested).not.toBe(previous.nested);
      expect(result.nested).toEqual({ x: 10 });
    });
  });

  describe('numeric operations', () => {
    it('applies increment', () => {
      const result = shadowMerge({ balance: 500 }, { balance: { increment: 100 } });
      expect(result.balance).toBe(600);
    });

    it('applies decrement', () => {
      const result = shadowMerge({ balance: 500 }, { balance: { decrement: 100 } });
      expect(result.balance).toBe(400);
    });

    it('applies multiply', () => {
      const result = shadowMerge({ price: 10 }, { price: { multiply: 2 } });
      expect(result.price).toBe(20);
    });

    it('applies divide', () => {
      const result = shadowMerge({ price: 100 }, { price: { divide: 4 } });
      expect(result.price).toBe(25);
    });

    it('handles increment on undefined (defaults to 0)', () => {
      const result = shadowMerge({}, { count: { increment: 5 } });
      expect(result.count).toBe(5);
    });

    it('handles decrement on undefined (defaults to 0)', () => {
      const result = shadowMerge({}, { count: { decrement: 5 } });
      expect(result.count).toBe(-5);
    });
  });

  describe('set operation', () => {
    it('replaces value with set', () => {
      const result = shadowMerge({ status: 'pending' }, { status: { set: 'active' } });
      expect(result.status).toBe('active');
    });

    it('set works on arrays (replaces entire array)', () => {
      const result = shadowMerge({ tags: ['a', 'b'] }, { tags: { set: ['x', 'y', 'z'] } });
      expect(result.tags).toEqual(['x', 'y', 'z']);
    });

    it('set can set to null', () => {
      const result = shadowMerge({ value: 100 }, { value: { set: null } });
      expect(result.value).toBeNull();
    });
  });

  describe('push operation (scalar lists)', () => {
    it('pushes single value to array', () => {
      const result = shadowMerge({ tags: ['a', 'b'] }, { tags: { push: 'c' } });
      expect(result.tags).toEqual(['a', 'b', 'c']);
    });

    it('pushes multiple values to array', () => {
      const result = shadowMerge({ tags: ['a'] }, { tags: { push: ['b', 'c'] } });
      expect(result.tags).toEqual(['a', 'b', 'c']);
    });

    it('handles push on undefined (creates new array)', () => {
      const result = shadowMerge({}, { tags: { push: 'first' } });
      expect(result.tags).toEqual(['first']);
    });

    it('handles push on non-array (creates new array)', () => {
      const result = shadowMerge({ tags: 'not-array' }, { tags: { push: 'value' } });
      expect(result.tags).toEqual(['value']);
    });
  });

  describe('mixed operations', () => {
    it('handles mix of regular values and operations', () => {
      const result = shadowMerge(
        { balance: 100, name: 'test', tags: ['a'] },
        { balance: { increment: 50 }, name: 'updated', tags: { push: 'b' } },
      );
      expect(result).toEqual({ balance: 150, name: 'updated', tags: ['a', 'b'] });
    });
  });

  describe('edge cases', () => {
    it('ignores objects that look like ops but have multiple keys', () => {
      const result = shadowMerge({}, { data: { increment: 1, decrement: 1 } });
      expect(result.data).toEqual({ increment: 1, decrement: 1 });
    });

    it('ignores objects with non-op keys', () => {
      const result = shadowMerge({}, { data: { foo: 'bar' } });
      expect(result.data).toEqual({ foo: 'bar' });
    });

    it('handles empty data object', () => {
      const result = shadowMerge({ a: 1 }, {});
      expect(result).toEqual({ a: 1 });
    });
  });
});
