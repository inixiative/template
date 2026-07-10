import { describe, expect, it } from 'bun:test';
import { liveIncludes, liveScope, liveScopeParent, liveWhere, mentionsDeletedAt } from '#/lib/prisma/softDeleteScope';

const LIVE = { deletedAt: null };

const WEBHOOK_LIVE = {
  AND: [
    { OR: [{ organization: { is: null } }, { organization: LIVE }] },
    { OR: [{ space: { is: null } }, { space: LIVE }] },
    { OR: [{ user: { is: null } }, { user: LIVE }] },
  ],
};

describe('liveScope', () => {
  it('a model with its own deletedAt column speaks for itself', () => {
    expect(liveScope('User')).toEqual(LIVE);
  });

  it('a model without one inherits from its to-one parents', () => {
    expect(liveScope('Session')).toEqual({ user: LIVE });
    expect(liveScope('WebhookSubscription')).toEqual(WEBHOOK_LIVE);
  });

  it('unknown model → nothing to enforce', () => {
    expect(liveScope('NotAModel')).toBeUndefined();
  });
});

describe('liveScopeParent', () => {
  it('recursion stops at the first deletedAt-bearing ancestor', () => {
    expect(liveScopeParent('Session')).toEqual({ user: LIVE });
  });

  it('cycle guard: a model already on the path contributes nothing', () => {
    expect(liveScopeParent('Session', ['Session'])).toBeUndefined();
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

  it('an explicit deletedAt at a hop wins at that node only', () => {
    expect(liveWhere('User', { tokens: { some: { deletedAt: { not: null } } } })).toEqual({
      tokens: { some: { deletedAt: { not: null } } },
      deletedAt: null,
    });
  });

  it('a hop into a column-less model gets its inherited scope', () => {
    expect(liveWhere('User', { sessions: { some: { id: 's-1' } } })).toEqual({
      sessions: { some: { id: 's-1', user: LIVE } },
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
  it('a bare to-many include grows a live-scope where; to-one stays bare', () => {
    expect(liveIncludes('Token', { auditLogsAsSubject: true, user: true })).toEqual({
      auditLogsAsSubject: { where: liveScope('AuditLog') },
      user: true,
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

  it('a column-less to-many target inherits its parents scope', () => {
    expect(liveIncludes('User', { sessions: true })).toEqual({
      sessions: { where: { user: LIVE } },
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
