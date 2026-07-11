import { describe, expect, it } from 'bun:test';
import type { LensNarrowing } from '@inixiative/json-rules';
import type { AnyDelegate } from '@template/db';
import { lensFor } from '@template/db/lens';
import { paginate } from '#/lib/prisma/paginate';

type Captured = { findManyArgs?: Record<string, unknown> };

const makeDelegate = (captured: Captured): AnyDelegate =>
  ({
    findMany: async (args: Record<string, unknown>) => {
      captured.findManyArgs = args;
      return [];
    },
    count: async () => 0,
  }) as unknown as AnyDelegate;

const makeContext = (
  filterLens: LensNarrowing,
  query: Record<string, unknown> = {},
  user: Record<string, unknown> | undefined = undefined,
) => {
  const vars: Record<string, unknown> = { filterLens, bracketQuery: {}, user };
  return {
    get: (key: string) => vars[key],
    req: { valid: () => query },
  } as unknown as Parameters<typeof paginate>[0];
};

const superadmin = { platformRole: 'superadmin' };

describe('paginate — lens bindings', () => {
  it('resolves `{ bind }` tokens into the lens before building the where', async () => {
    const captured: Captured = {};
    const lens: LensNarrowing = {
      parent: lensFor('User'),
      root: { picks: [], where: { field: 'name', operator: 'equals', bind: 'who' } },
    };

    await paginate(makeContext(lens), makeDelegate(captured), { bindings: { who: 'aron' } });

    expect(captured.findManyArgs?.where).toEqual({
      AND: [{}, {}],
      name: { equals: 'aron' },
      deletedAt: null,
    });
  });

  it('throws 500 when the lens requires a binding that was not provided', async () => {
    const lens: LensNarrowing = {
      parent: lensFor('User'),
      root: { picks: [], where: { field: 'name', operator: 'equals', bind: 'who' } },
    };

    expect(paginate(makeContext(lens), makeDelegate({}))).rejects.toThrow(/lens requires bindings not provided: who/);
  });

  it('passes a bind-free lens through untouched, no bindings needed', async () => {
    const captured: Captured = {};
    const lens: LensNarrowing = { parent: lensFor('User'), root: { picks: ['name'] } };

    const result = await paginate(makeContext(lens), makeDelegate(captured));

    expect(captured.findManyArgs?.where).toEqual({ AND: [{}, {}], deletedAt: null });
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });
});

describe('paginate — soft-delete scope', () => {
  const userLens: LensNarrowing = { parent: lensFor('User'), root: { picks: ['name'] } };

  it('folds live scope onto to-many include levels; column-less targets stay bare', async () => {
    const captured: Captured = {};

    await paginate(makeContext(userLens), makeDelegate(captured), {
      include: {
        tokens: { where: { isActive: true }, include: { user: true } },
        sessions: true,
      },
    });

    expect(captured.findManyArgs?.include).toEqual({
      tokens: { where: { isActive: true, deletedAt: null }, include: { user: true } },
      sessions: true,
    });
  });

  it('an explicit deletedAt on an include level wins', async () => {
    const captured: Captured = {};

    await paginate(makeContext(userLens), makeDelegate(captured), {
      include: { tokens: { where: { deletedAt: { not: null } } } },
    });

    expect(captured.findManyArgs?.include).toEqual({
      tokens: { where: { deletedAt: { not: null } } },
    });
  });

  it('an explicit root deletedAt in the caller where skips the root injection', async () => {
    const captured: Captured = {};

    await paginate(makeContext(userLens), makeDelegate(captured), {
      where: { deletedAt: { not: null } },
    });

    expect(captured.findManyArgs?.where).toEqual({ AND: [{ deletedAt: { not: null } }, {}] });
  });

  it('superadmin sees soft-deleted rows: no injection in the where or the include', async () => {
    const captured: Captured = {};

    await paginate(makeContext(userLens, {}, superadmin), makeDelegate(captured), {
      include: { tokens: true },
    });

    expect(captured.findManyArgs?.where).toEqual({ AND: [{}, {}] });
    expect(captured.findManyArgs?.include).toEqual({ tokens: true });
  });

  it('a model without its own column gets no injection (the cascade hook owns consistency)', async () => {
    const captured: Captured = {};
    const lens: LensNarrowing = { parent: lensFor('WebhookSubscription'), root: { picks: ['url'] } };

    await paginate(makeContext(lens), makeDelegate(captured));

    expect(captured.findManyArgs?.where).toEqual({ AND: [{}, {}] });
  });
});
