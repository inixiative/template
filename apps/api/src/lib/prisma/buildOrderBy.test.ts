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

  it('keeps distinct fields of the same relation (dedupe by full path, not top-level key)', () => {
    expect(
      buildOrderBy({ clientOrderBy: ['user.name:asc', 'user.email:desc'] }),
    ).toEqual([{ user: { name: 'asc' } }, { user: { email: 'desc' } }, { id: 'desc' }]);
  });

  it('builds nested orderBy for deep relation dot-paths', () => {
    expect(
      buildOrderBy({ clientOrderBy: ['user.organization.name:asc'] }),
    ).toEqual([{ user: { organization: { name: 'asc' } } }, { id: 'desc' }]);
  });
});
