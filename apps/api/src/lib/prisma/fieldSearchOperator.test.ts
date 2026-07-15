import { describe, expect, it } from 'bun:test';
import { fieldSearchOperator } from '#/lib/prisma/fieldSearchOperator';

describe('fieldSearchOperator', () => {
  it('String scalar → case-insensitive contains', () => {
    expect(fieldSearchOperator({ kind: 'scalar', type: 'String' }, 'foo')).toEqual({
      contains: 'foo',
      mode: 'insensitive',
    });
  });

  it('String[] → has (exact element)', () => {
    expect(fieldSearchOperator({ kind: 'scalar', type: 'String', isList: true }, 'foo')).toEqual({ has: 'foo' });
  });

  it('Json → string_contains', () => {
    expect(fieldSearchOperator({ kind: 'scalar', type: 'Json' }, 'foo')).toEqual({ string_contains: 'foo' });
  });

  it('non-text scalars and relations → undefined (skipped)', () => {
    expect(fieldSearchOperator({ kind: 'scalar', type: 'Int' }, 'foo')).toBeUndefined();
    expect(fieldSearchOperator({ kind: 'scalar', type: 'DateTime' }, 'foo')).toBeUndefined();
    expect(fieldSearchOperator({ kind: 'enum', type: 'Role' }, 'foo')).toBeUndefined();
    expect(fieldSearchOperator({ kind: 'object', type: 'User' }, 'foo')).toBeUndefined();
  });
});
