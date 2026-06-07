import { describe, expect, it } from 'bun:test';
import { Prisma } from '@template/db';
import { buildJsonWhere } from '#/lib/prisma/jsonFilter';

describe('buildJsonWhere (Postgres)', () => {
  it('passes value operators through', () => {
    expect(buildJsonWhere({ string_contains: 'x' }, 'meta')).toEqual({ string_contains: 'x' });
    expect(buildJsonWhere({ equals: 'a', not: 'b' }, 'meta')).toEqual({ equals: 'a', not: 'b' });
  });

  it('normalizes path: dotted string → key array', () => {
    expect(buildJsonWhere({ path: 'a.b', string_contains: 'x' }, 'meta')).toEqual({
      path: ['a', 'b'],
      string_contains: 'x',
    });
  });

  it('keeps an array path as-is', () => {
    expect(buildJsonWhere({ path: ['a', 'b'], equals: 'x' }, 'meta')).toEqual({ path: ['a', 'b'], equals: 'x' });
  });

  it('rejects an unknown json operator', () => {
    expect(() => buildJsonWhere({ gt: 'x' }, 'meta')).toThrow();
  });

  it('maps a null value to AnyNull (matches db-NULL and json-null)', () => {
    expect(buildJsonWhere({ equals: null }, 'meta')).toEqual({ equals: Prisma.AnyNull });
    expect(buildJsonWhere({ not: null }, 'meta')).toEqual({ not: Prisma.AnyNull });
  });
});
