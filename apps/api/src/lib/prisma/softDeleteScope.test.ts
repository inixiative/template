import { describe, expect, it } from 'bun:test';
import { liveIncludes, liveWhere } from '#/lib/prisma/softDeleteScope';

const LIVE = { deletedAt: null };

describe('liveWhere', () => {
  it('appends the root live scope for a model with a deletedAt column', () => {
    expect(liveWhere('User', { AND: [{}, {}] })).toEqual({ AND: [{}, {}], deletedAt: null });
  });

  it('a column-less model gets no injection (the cascade hook owns consistency)', () => {
    expect(liveWhere('Session', { AND: [{}, {}] })).toEqual({ AND: [{}, {}] });
    expect(liveWhere('WebhookSubscription', {})).toEqual({});
  });

  it('unknown model → untouched', () => {
    expect(liveWhere('NotAModel', { a: 1 })).toEqual({ a: 1 });
  });

  it('an explicit root deletedAt wins, wherever it sits under boolean combinators', () => {
    const where = { AND: [{ deletedAt: { not: null } }, {}] };
    expect(liveWhere('User', where)).toEqual(where);
    expect(liveWhere('User', { NOT: { deletedAt: null } })).toEqual({ NOT: { deletedAt: null } });
  });

  it('an explicit `deletedAt: undefined` opts out (the admin tri-state `all` branch)', () => {
    expect(liveWhere('User', { deletedAt: undefined, name: 'x' })).toEqual({ deletedAt: undefined, name: 'x' });
  });

  it('a deletedAt under a relation key does not count as a root mention', () => {
    expect(liveWhere('Token', { user: { deletedAt: null } })).toEqual({
      user: { deletedAt: null },
      deletedAt: null,
    });
  });

  it('scopes a to-many `some` hop and the root', () => {
    expect(liveWhere('User', { tokens: { some: { name: 'x' } } })).toEqual({
      tokens: { some: { name: 'x', deletedAt: null } },
      deletedAt: null,
    });
  });

  it('scopes inside `none` — deleted rows cannot satisfy the predicate', () => {
    expect(liveWhere('User', { tokens: { none: { name: 'x' } } })).toEqual({
      tokens: { none: { name: 'x', deletedAt: null } },
      deletedAt: null,
    });
  });

  it('`every` gets scope by implication: deleted rows never fail it', () => {
    expect(liveWhere('User', { tokens: { every: { name: 'x' } } })).toEqual({
      tokens: { every: { OR: [{ NOT: LIVE }, { name: 'x' }] } },
      deletedAt: null,
    });
  });

  it('bare `isNot` gets a fail-closed `is` sibling', () => {
    expect(liveWhere('Token', { user: { isNot: { name: 'x' } } })).toEqual({
      user: { isNot: { name: 'x' }, is: LIVE },
      deletedAt: null,
    });
  });

  it('bare to-one shorthand scopes the target node', () => {
    expect(liveWhere('Token', { user: { name: 'x' } })).toEqual({
      user: { name: 'x', deletedAt: null },
      deletedAt: null,
    });
  });

  it('a hop into a column-less model passes through untouched', () => {
    expect(liveWhere('User', { sessions: { some: { id: 's-1' } } })).toEqual({
      sessions: { some: { id: 's-1' } },
      deletedAt: null,
    });
  });

  it('an explicit deletedAt at a hop wins at that node only', () => {
    expect(liveWhere('User', { tokens: { some: { deletedAt: { not: null } } } })).toEqual({
      tokens: { some: { deletedAt: { not: null } } },
      deletedAt: null,
    });
  });

  it('boolean combinators stay on the same model', () => {
    expect(liveWhere('User', { OR: [{ tokens: { some: { name: 'x' } } }, { name: 'y' }] })).toEqual({
      OR: [{ tokens: { some: { name: 'x', deletedAt: null } } }, { name: 'y' }],
      deletedAt: null,
    });
  });

  it('non-relation values pass through untouched', () => {
    expect(liveWhere('User', { email: { in: ['a', 'b'] }, name: 'x' })).toEqual({
      email: { in: ['a', 'b'] },
      name: 'x',
      deletedAt: null,
    });
  });
});

describe('liveIncludes', () => {
  it('a bare to-many include grows a live-scope where; to-one and column-less stay bare', () => {
    expect(liveIncludes('User', { tokens: true, sessions: true })).toEqual({
      tokens: { where: LIVE },
      sessions: true,
    });
  });

  it('an existing include where is walked and scoped', () => {
    expect(liveIncludes('User', { tokens: { where: { isActive: true } } })).toEqual({
      tokens: { where: { isActive: true, deletedAt: null } },
    });
  });

  it('an explicit deletedAt on a level wins', () => {
    expect(liveIncludes('User', { tokens: { where: { deletedAt: { not: null } } } })).toEqual({
      tokens: { where: { deletedAt: { not: null } } },
    });
  });

  it('recurses through nested include trees', () => {
    expect(liveIncludes('User', { tokens: { include: { user: true } } })).toEqual({
      tokens: { where: LIVE, include: { user: true } },
    });
  });

  it('non-relation entries pass through', () => {
    expect(liveIncludes('User', { _count: { select: { tokens: true } } })).toEqual({
      _count: { select: { tokens: true } },
    });
  });
});
