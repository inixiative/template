import { describe, expect, it } from 'bun:test';
import { Prisma } from '@template/db/generated/client/client';
import { applyWriteDataOverPreviousRow } from '@template/db/utils/applyWriteDataOverPreviousRow';

describe('applyWriteDataOverPreviousRow', () => {
  it('merges plain fields over previous without mutating previous', () => {
    const previous = { a: 1, b: 2, nested: { x: 1 } };
    const result = applyWriteDataOverPreviousRow(previous, { b: 3, c: 4 });
    expect(result).toEqual({ a: 1, b: 3, c: 4, nested: { x: 1 } });
    expect(previous).toEqual({ a: 1, b: 2, nested: { x: 1 } });
    expect(result.nested).not.toBe(previous.nested);
  });

  it('handles undefined previous', () => {
    expect(applyWriteDataOverPreviousRow(undefined, { a: 1 })).toEqual({ a: 1 });
  });

  it('applies Prisma numeric and array atomic operations on scalar columns', () => {
    expect(applyWriteDataOverPreviousRow({ count: 10 }, { count: { increment: 5 } })).toEqual({
      count: 15,
    });
    expect(applyWriteDataOverPreviousRow({ count: 10 }, { count: { decrement: 3 } })).toEqual({
      count: 7,
    });
    expect(applyWriteDataOverPreviousRow({ price: 10 }, { price: { multiply: 2 } })).toEqual({
      price: 20,
    });
    expect(applyWriteDataOverPreviousRow({ price: 100 }, { price: { divide: 4 } })).toEqual({
      price: 25,
    });
    expect(applyWriteDataOverPreviousRow({}, { count: { increment: 5 } })).toEqual({ count: 5 });
    expect(applyWriteDataOverPreviousRow({ value: 100 }, { value: { set: null } })).toEqual({
      value: null,
    });
    expect(applyWriteDataOverPreviousRow({ tags: ['a', 'b'] }, { tags: { push: 'c' } })).toEqual({
      tags: ['a', 'b', 'c'],
    });
    expect(applyWriteDataOverPreviousRow({ tags: ['a'] }, { tags: { push: ['b', 'c'] } })).toEqual({
      tags: ['a', 'b', 'c'],
    });
  });

  it('clears Prisma.DbNull to null while preserving Prisma.JsonNull and JSON objects containing a set key', () => {
    expect(
      applyWriteDataOverPreviousRow(
        { valueJson: { a: 1 } },
        { valueJson: Prisma.DbNull },
        { model: 'Setting' },
      ),
    ).toEqual({ valueJson: null });

    expect(
      applyWriteDataOverPreviousRow(
        { valueJson: { a: 1 } },
        { valueJson: Prisma.JsonNull },
        { model: 'Setting' },
      ),
    ).toEqual({ valueJson: Prisma.JsonNull });

    // Single-key `{ set: 'strict' }` on a Json column is a JSON payload, NOT a Prisma scalar op!
    expect(
      applyWriteDataOverPreviousRow(
        { valueJson: { old: true } },
        { valueJson: { set: 'strict' } },
        { model: 'Setting' },
      ),
    ).toEqual({ valueJson: { set: 'strict' } });

    expect(
      applyWriteDataOverPreviousRow(
        { valueJson: { old: true } },
        { valueJson: { set: 'strict', retries: 3 } },
        { model: 'Setting' },
      ),
    ).toEqual({ valueJson: { set: 'strict', retries: 3 } });
  });

  it('preserves multi-key objects and Date instances untouched', () => {
    const now = new Date('2026-12-01T00:00:00.000Z');
    expect(
      applyWriteDataOverPreviousRow(
        {},
        { data: { increment: 1, decrement: 1 }, valueDate: now },
        { model: 'Setting' },
      ),
    ).toEqual({ data: { increment: 1, decrement: 1 }, valueDate: now });
  });
});
