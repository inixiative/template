import { afterAll, describe, expect, it } from 'bun:test';
import type { LensNarrowing } from '@inixiative/json-rules';
import { db } from '@template/db';
import { lensFor } from '@template/db/lens';
import { cleanupTouchedTables, createToken, createUser } from '@template/db/test';
import { lensWhere } from '#/lib/prisma/lensWhere';

const ACTIVE_TOKENS: LensNarrowing = {
  parent: lensFor('User'),
  root: {
    picks: ['name'],
    relations: {
      tokens: { picks: ['name'], where: { field: 'isActive', operator: 'equals', value: true } },
    },
  },
};

describe('lensWhere — relation-node wheres', () => {
  it('folds a relation-node where into every traversal of that relation', async () => {
    expect(await lensWhere(ACTIVE_TOKENS, { tokens: { some: { name: 'x' } } })).toEqual({
      tokens: { some: { name: 'x', isActive: { equals: true } } },
    });
  });

  it('a relation the query never traverses contributes nothing', async () => {
    expect(await lensWhere(ACTIVE_TOKENS, { name: 'x' })).toEqual({ name: 'x' });
  });

  it('composes into `every` by implication', async () => {
    expect(await lensWhere(ACTIVE_TOKENS, { tokens: { every: { name: 'x' } } })).toEqual({
      tokens: { every: { OR: [{ NOT: { isActive: { equals: true } } }, { name: 'x' }] } },
    });
  });

  it('bare `isNot` gets the node where as a fail-closed `is` sibling', async () => {
    expect(await lensWhere(ACTIVE_TOKENS, { tokens: { isNot: { name: 'x' } } })).toEqual({
      tokens: { isNot: { name: 'x' }, is: { isActive: { equals: true } } },
    });
  });

  it('a lens with no wheres returns the where untouched', async () => {
    const bare: LensNarrowing = { parent: lensFor('User'), root: { picks: ['name'] } };
    const where = { tokens: { some: { name: 'x' } } };
    expect(await lensWhere(bare, where)).toBe(where);
  });

  it('a nested relation where applies at its own depth', async () => {
    const nested: LensNarrowing = {
      parent: lensFor('Organization'),
      root: {
        picks: ['name'],
        relations: {
          spaces: {
            picks: ['name'],
            relations: {
              tokens: { picks: ['name'], where: { field: 'isActive', operator: 'equals', value: true } },
            },
          },
        },
      },
    };
    expect(await lensWhere(nested, { spaces: { some: { tokens: { some: { name: 'x' } } } } })).toEqual({
      spaces: { some: { tokens: { some: { name: 'x', isActive: { equals: true } } } } },
    });
  });
});

describe('lensWhere — root wheres (path "")', () => {
  const role = { platformRole: { equals: 'superadmin' } };
  const verified = { emailVerified: { equals: true } };

  it('applies the route layer root.where to every row', async () => {
    const lens: LensNarrowing = {
      parent: lensFor('User'),
      root: { picks: [], where: { field: 'platformRole', operator: 'equals', value: 'superadmin' } },
    };
    expect(await lensWhere(lens, {})).toEqual(role);
  });

  it('composes every stacked scopeNarrowing layer, ANDed', async () => {
    const lens: LensNarrowing = {
      parent: {
        parent: lensFor('User'),
        root: { picks: [], where: { field: 'platformRole', operator: 'equals', value: 'superadmin' } },
      },
      root: { where: { field: 'emailVerified', operator: 'equals', value: true } },
    };
    const result = (await lensWhere(lens, { name: 'x' })) as { AND: unknown[] };
    expect(result.AND).toHaveLength(3);
    expect(result.AND).toEqual(expect.arrayContaining([{ name: 'x' }, role, verified]));
  });

  it('applies mapDefaults wheres anchored to the root model', async () => {
    const lens: LensNarrowing = {
      parent: lensFor('User'),
      root: { picks: [] },
      mapDefaults: { prisma: { models: { User: { where: { field: 'name', operator: 'equals', value: 'x' } } } } },
    };
    expect(await lensWhere(lens, {})).toEqual({ name: { equals: 'x' } });
  });

  it('a root deletedAt where passes through as declared (tri-state style)', async () => {
    const lens: LensNarrowing = {
      parent: lensFor('User'),
      root: { picks: [], where: { field: 'deletedAt', operator: 'notEquals', value: null } },
    };
    expect(await lensWhere(lens, {})).toEqual({ deletedAt: { not: null } });
  });
});

describe('lensWhere — query-plan execution (count operators)', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('executes the groupBy plan and returns a runnable where scoping rows by relation count', async () => {
    const { entity: qualified } = await createUser();
    const { entity: unqualified } = await createUser();
    await createToken({ isActive: true }, { user: qualified });
    await createToken({ isActive: true }, { user: qualified });
    await createToken({ isActive: false }, { user: unqualified });

    const lens: LensNarrowing = {
      parent: lensFor('User'),
      root: {
        picks: ['name'],
        where: {
          field: 'tokens',
          arrayOperator: 'atLeast',
          count: 2,
          condition: { field: 'isActive', operator: 'equals', value: true },
        },
      },
    };

    const where = await lensWhere(lens, {});
    const rows = await db.user.findMany({
      where: { AND: [{ id: { in: [qualified.id, unqualified.id] } }, where] },
    });
    expect(rows.map((r) => r.id)).toEqual([qualified.id]);
  });
});
