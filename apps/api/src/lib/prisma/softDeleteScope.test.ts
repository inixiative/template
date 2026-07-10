import { describe, expect, it } from 'bun:test';
import { liveIncludes, liveScope, liveWhere, mentionsDeletedAt } from '#/lib/prisma/softDeleteScope';

const LIVE = { deletedAt: null };

describe('liveScope', () => {
  it('a model with a deletedAt column → { deletedAt: null }', () => {
    expect(liveScope('User')).toEqual(LIVE);
  });

  it('a model without one has no query-time scope (the cascade hook owns consistency)', () => {
    expect(liveScope('Session')).toBeUndefined();
    expect(liveScope('WebhookSubscription')).toBeUndefined();
  });

  it('unknown model → nothing to enforce', () => {
    expect(liveScope('NotAModel')).toBeUndefined();
  });
});

describe('mentionsDeletedAt', () => {
  it('top-level key, including an explicit `undefined` opt-out', () => {
    expect(mentionsDeletedAt({ deletedAt: { not: null } })).toBe(true);
    expect(mentionsDeletedAt({ deletedAt: undefined })).toBe(true);
  });

  it('recurses through boolean combinators only', () => {
    expect(mentionsDeletedAt({ AND: [{ name: 'x' }, { OR: [{ deletedAt: null }] }] })).toBe(true);
    expect(mentionsDeletedAt({ NOT: { deletedAt: null } })).toBe(true);
    expect(mentionsDeletedAt({ user: { deletedAt: null } })).toBe(false);
  });
});

describe('liveWhere', () => {
  it('appends the root live scope', () => {
    expect(liveWhere('User', { AND: [{}, {}] })).toEqual({ AND: [{}, {}], deletedAt: null });
  });

  it('an explicit root deletedAt wins', () => {
    const where = { AND: [{ deletedAt: { not: null } }, {}] };
    expect(liveWhere('User', where)).toEqual(where);
  });

  it('a column-less root gets no injection', () => {
    expect(liveWhere('Session', { AND: [{}, {}] })).toEqual({ AND: [{}, {}] });
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
