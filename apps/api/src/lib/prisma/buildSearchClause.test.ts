import { describe, expect, it } from 'bun:test';
import { buildSearchClause } from '#/lib/prisma/buildSearchClause';

describe('buildSearchClause', () => {
  it('String scalar → case-insensitive contains', () => {
    expect(buildSearchClause({ kind: 'scalar', type: 'String' }, 'foo')).toEqual({
      contains: 'foo',
      mode: 'insensitive',
    });
  });

  it('String[] → has (exact element)', () => {
    expect(buildSearchClause({ kind: 'scalar', type: 'String', isList: true }, 'foo')).toEqual({ has: 'foo' });
  });

  it('Json → string_contains', () => {
    expect(buildSearchClause({ kind: 'scalar', type: 'Json' }, 'foo')).toEqual({ string_contains: 'foo' });
  });

  it('non-text scalars and relations → undefined (skipped)', () => {
    expect(buildSearchClause({ kind: 'scalar', type: 'Int' }, 'foo')).toBeUndefined();
    expect(buildSearchClause({ kind: 'scalar', type: 'DateTime' }, 'foo')).toBeUndefined();
    expect(buildSearchClause({ kind: 'enum', type: 'Role' }, 'foo')).toBeUndefined();
    expect(buildSearchClause({ kind: 'object', type: 'User' }, 'foo')).toBeUndefined();
  });
});
