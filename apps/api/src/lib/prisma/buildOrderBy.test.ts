import { describe, expect, it } from 'bun:test';
import { buildOrderBy } from '#/lib/prisma/buildOrderBy';

describe('buildOrderBy', () => {
  it('appends the id desc tiebreaker', () => {
    expect(buildOrderBy({})).toEqual([{ id: 'desc' }]);
  });

  it('parses client orderBy and appends tiebreaker', () => {
    expect(buildOrderBy({ clientOrderBy: ['name:asc'] })).toEqual([{ name: 'asc' }, { id: 'desc' }]);
  });

  it('caller keys win over client + tiebreaker on the same top-level key', () => {
    const result = buildOrderBy({ callerOrderBy: { name: 'desc' }, clientOrderBy: ['name:asc'] });
    expect(result).toEqual([{ name: 'desc' }, { id: 'desc' }]);
  });

  it('dedupes a client sort that repeats the default id key', () => {
    expect(buildOrderBy({ clientOrderBy: ['id:asc'] })).toEqual([{ id: 'asc' }]);
  });

  it('validates client fields against the allowlist', () => {
    expect(() => buildOrderBy({ clientOrderBy: ['secret:asc'], orderableFields: ['name'] })).toThrow();
  });

  it('skips validation when orderableFields is undefined', () => {
    expect(buildOrderBy({ clientOrderBy: ['anything:asc'] })).toEqual([{ anything: 'asc' }, { id: 'desc' }]);
  });
});
