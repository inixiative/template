import { describe, expect, it } from 'bun:test';
import { notDeletedIncludes, notDeletedWhere } from '@template/db/extensions/softDeleteScope';

const NOT_DELETED = { deletedAt: null };

describe('notDeletedWhere', () => {
  it('appends the root not-deleted scope for a model with a deletedAt column', () => {
    expect(notDeletedWhere('User', { AND: [{}, {}] })).toEqual({
      AND: [{}, {}],
      deletedAt: null,
    });
  });

  it('a column-less model gets no injection (the cascade hook owns consistency)', () => {
    expect(notDeletedWhere('Session', { AND: [{}, {}] })).toEqual({ AND: [{}, {}] });
    expect(notDeletedWhere('WebhookSubscription', {})).toEqual({});
  });

  it('unknown model → untouched', () => {
    expect(notDeletedWhere('NotAModel', { a: 1 })).toEqual({ a: 1 });
  });

  it('an explicit root deletedAt wins, wherever it sits under boolean combinators', () => {
    const where = { AND: [{ deletedAt: { not: null } }, {}] };
    expect(notDeletedWhere('User', where)).toEqual(where);
    expect(notDeletedWhere('User', { NOT: { deletedAt: null } })).toEqual({
      NOT: { deletedAt: null },
    });
  });

  it('an explicit `deletedAt: undefined` opts out (the admin tri-state `all` branch)', () => {
    expect(notDeletedWhere('User', { deletedAt: undefined, name: 'x' })).toEqual({
      deletedAt: undefined,
      name: 'x',
    });
  });

  it('a deletedAt under a relation key does not count as a root mention', () => {
    expect(notDeletedWhere('Contact', { user: { deletedAt: null } })).toEqual({
      user: { deletedAt: null },
      deletedAt: null,
    });
  });

  it('scopes a to-many `some` hop and the root', () => {
    expect(notDeletedWhere('User', { contacts: { some: { name: 'x' } } })).toEqual({
      contacts: { some: { name: 'x', deletedAt: null } },
      deletedAt: null,
    });
  });

  it('scopes inside `none` — deleted rows cannot satisfy the predicate', () => {
    expect(notDeletedWhere('User', { contacts: { none: { name: 'x' } } })).toEqual({
      contacts: { none: { name: 'x', deletedAt: null } },
      deletedAt: null,
    });
  });

  it('`every` gets scope by implication: deleted rows never fail it', () => {
    expect(notDeletedWhere('User', { contacts: { every: { name: 'x' } } })).toEqual({
      contacts: { every: { OR: [{ NOT: NOT_DELETED }, { name: 'x' }] } },
      deletedAt: null,
    });
  });

  it('bare `isNot` gets a fail-closed `is` sibling', () => {
    expect(notDeletedWhere('Contact', { user: { isNot: { name: 'x' } } })).toEqual({
      user: { isNot: { name: 'x' }, is: NOT_DELETED },
      deletedAt: null,
    });
  });

  it('bare to-one shorthand scopes the target node', () => {
    expect(notDeletedWhere('Contact', { user: { name: 'x' } })).toEqual({
      user: { name: 'x', deletedAt: null },
      deletedAt: null,
    });
  });

  it('a hop into a column-less model passes through untouched', () => {
    expect(notDeletedWhere('User', { sessions: { some: { id: 's-1' } } })).toEqual({
      sessions: { some: { id: 's-1' } },
      deletedAt: null,
    });
  });

  it('an explicit deletedAt at a hop wins at that node only', () => {
    expect(notDeletedWhere('User', { contacts: { some: { deletedAt: { not: null } } } })).toEqual({
      contacts: { some: { deletedAt: { not: null } } },
      deletedAt: null,
    });
  });

  it('boolean combinators stay on the same model', () => {
    expect(
      notDeletedWhere('User', { OR: [{ contacts: { some: { name: 'x' } } }, { name: 'y' }] }),
    ).toEqual({
      OR: [{ contacts: { some: { name: 'x', deletedAt: null } } }, { name: 'y' }],
      deletedAt: null,
    });
  });

  it('non-relation values pass through untouched', () => {
    expect(notDeletedWhere('User', { email: { in: ['a', 'b'] }, name: 'x' })).toEqual({
      email: { in: ['a', 'b'] },
      name: 'x',
      deletedAt: null,
    });
  });
});

describe('notDeletedIncludes', () => {
  it('a bare to-many include grows a not-deleted-scope where; a column-less target stays bare', () => {
    expect(notDeletedIncludes('User', { contacts: true, sessions: true })).toEqual({
      contacts: { where: NOT_DELETED },
      sessions: true,
    });
  });

  it('a bare optional to-one include grows a not-deleted-scope where', () => {
    expect(notDeletedIncludes('Contact', { user: true })).toEqual({ user: { where: NOT_DELETED } });
  });

  it('a required to-one include stays bare, because Prisma gives it no where', () => {
    expect(notDeletedIncludes('Account', { user: true })).toEqual({ user: true });
  });

  it('an existing include where is walked and scoped', () => {
    expect(notDeletedIncludes('User', { contacts: { where: { isActive: true } } })).toEqual({
      contacts: { where: { isActive: true, deletedAt: null } },
    });
  });

  it('an explicit deletedAt on a level wins', () => {
    expect(
      notDeletedIncludes('User', { contacts: { where: { deletedAt: { not: null } } } }),
    ).toEqual({
      contacts: { where: { deletedAt: { not: null } } },
    });
  });

  it('recurses through nested include trees', () => {
    expect(notDeletedIncludes('User', { contacts: { include: { user: true } } })).toEqual({
      contacts: { where: NOT_DELETED, include: { user: { where: NOT_DELETED } } },
    });
  });

  it('scopes _count relation counts; column-less targets stay bare', () => {
    expect(
      notDeletedIncludes('User', { _count: { select: { contacts: true, sessions: true } } }),
    ).toEqual({
      _count: { select: { contacts: { where: NOT_DELETED }, sessions: true } },
    });
  });

  it('an explicit deletedAt in a _count where wins', () => {
    const tree = { _count: { select: { contacts: { where: { deletedAt: { not: null } } } } } };
    expect(notDeletedIncludes('User', tree)).toEqual(tree);
  });

  it('expands `_count: true` so every scoped relation count excludes deleted rows', () => {
    const scoped = notDeletedIncludes('User', { _count: true })._count as {
      select: Record<string, unknown>;
    };
    expect(scoped.select.contacts).toEqual({ where: NOT_DELETED });
    expect(scoped.select.sessions).toBe(true);
  });
});
