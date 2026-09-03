import { describe, expect, it } from 'bun:test';
import { AppError } from '#/lib/errors';
import {
  assertChainMatches,
  buildKeysetWhere,
  decodeCursor,
  encodeCursor,
  hydrateCursorValues,
  type SortKey,
} from '#/lib/prisma/keysetCursor';

const ID_ASC: SortKey[] = [['id', 'asc']];
const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString('base64url');

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a single-key chain and its values', () => {
    const decoded = decodeCursor(encodeCursor(ID_ASC, ['abc-123']));
    expect(decoded.k).toEqual([['id', 'asc']]);
    expect(decoded.p).toEqual(['abc-123']);
  });

  it('round-trips a multi-key chain', () => {
    const chain: SortKey[] = [
      ['name', 'desc'],
      ['id', 'asc'],
    ];
    const decoded = decodeCursor(encodeCursor(chain, ['active', 'z-9']));
    expect(decoded.k).toEqual(chain);
    expect(decoded.p).toEqual(['active', 'z-9']);
  });

  it('serializes Date values as ISO strings', () => {
    const chain: SortKey[] = [
      ['updatedAt', 'desc'],
      ['id', 'asc'],
    ];
    const decoded = decodeCursor(encodeCursor(chain, [new Date('2026-07-22T10:00:00.000Z'), 'u-1']));
    expect(decoded.p).toEqual(['2026-07-22T10:00:00.000Z', 'u-1']);
  });

  it('rejects a malformed token', () => {
    expect(() => decodeCursor('not-valid-base64url!!!')).toThrow(AppError);
  });

  it('rejects a token with the wrong version', () => {
    expect(() => decodeCursor(encode({ v: 99, k: ID_ASC, p: ['x'] }))).toThrow(AppError);
  });

  // why: a too-short cursor produces { gt: undefined }, which Prisma drops silently — the caller
  // why: re-walks page 1 forever rather than seeing an error.
  it('rejects a token whose value count does not match its key count', () => {
    const chain: SortKey[] = [
      ['name', 'desc'],
      ['id', 'asc'],
    ];
    expect(() => decodeCursor(encode({ v: 1, k: chain, p: ['active'] }))).toThrow(AppError);
    expect(() => decodeCursor(encode({ v: 1, k: ID_ASC, p: ['a', 'b'] }))).toThrow(AppError);
  });

  it('rejects a null value (would reach Prisma as `{ gt: null }`)', () => {
    expect(() => decodeCursor(encode({ v: 1, k: ID_ASC, p: [null] }))).toThrow(AppError);
  });

  it('rejects a non-scalar value', () => {
    expect(() => decodeCursor(encode({ v: 1, k: ID_ASC, p: [{}] }))).toThrow(AppError);
    expect(() => decodeCursor(encode({ v: 1, k: ID_ASC, p: [[]] }))).toThrow(AppError);
  });

  // why: a duplicate key collapses in buildKeysetWhere, so the seek never advances.
  it('rejects a duplicate-key chain', () => {
    const dup: SortKey[] = [
      ['id', 'asc'],
      ['id', 'asc'],
    ];
    expect(() => decodeCursor(encode({ v: 1, k: dup, p: ['a', 'b'] }))).toThrow(AppError);
  });
});

describe('hydrateCursorValues', () => {
  it('passes non-BigInt columns through untouched', () => {
    const chain: SortKey[] = [
      ['updatedAt', 'desc'],
      ['id', 'asc'],
    ];
    expect(hydrateCursorValues('User', chain, ['2026-07-22T10:00:00.000Z', 'u-1'])).toEqual([
      '2026-07-22T10:00:00.000Z',
      'u-1',
    ]);
  });
});

describe('assertChainMatches', () => {
  it('passes when the cursor chain equals the resolved chain', () => {
    expect(() => assertChainMatches([['id', 'asc']], ID_ASC)).not.toThrow();
  });

  it('throws when the key differs', () => {
    expect(() => assertChainMatches([['createdAt', 'asc']], ID_ASC)).toThrow(AppError);
  });

  it('throws when the direction differs', () => {
    expect(() => assertChainMatches([['id', 'desc']], ID_ASC)).toThrow(AppError);
  });

  it('throws when the chain length differs', () => {
    expect(() =>
      assertChainMatches(
        [
          ['id', 'asc'],
          ['createdAt', 'desc'],
        ],
        ID_ASC,
      ),
    ).toThrow(AppError);
  });
});

describe('buildKeysetWhere', () => {
  it('builds a simple greater-than for a single ascending key', () => {
    expect(buildKeysetWhere(ID_ASC, ['abc'])).toEqual({ OR: [{ id: { gt: 'abc' } }] });
  });

  it('builds a less-than for a descending key', () => {
    expect(buildKeysetWhere([['createdAt', 'desc']], ['2026-01-01'])).toEqual({
      OR: [{ createdAt: { lt: '2026-01-01' } }],
    });
  });

  // why: Prisma has no row-value comparison, so each clause pins every prior key to equality and
  // why: compares only the next one — without that, rows tying on the lead key are skipped.
  it('expands a composite chain into an OR of equality-pinned comparisons', () => {
    const chain: SortKey[] = [
      ['name', 'desc'],
      ['id', 'asc'],
    ];
    expect(buildKeysetWhere(chain, ['bob', 'u-5'])).toEqual({
      OR: [{ name: { lt: 'bob' } }, { name: 'bob', id: { gt: 'u-5' } }],
    });
  });
});
