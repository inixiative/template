import { describe, expect, it } from 'bun:test';
import type { LensNarrowing } from '@inixiative/json-rules';
import type { AnyDelegate } from '@template/db';
import { lensFor } from '@template/db/lens';
import { AppError } from '#/lib/errors';
import { cursorPaginate, paginate } from '#/lib/prisma/paginate';

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
        contacts: { where: { isActive: true }, include: { user: true } },
        sessions: true,
      },
    });

    expect(captured.findManyArgs?.include).toEqual({
      contacts: { where: { isActive: true, deletedAt: null }, include: { user: true } },
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

type Row = { id: string };

// A delegate that honours the keyset: it reads the `id > cursor` seek out of the composed where
// and returns rows strictly after it, so a walk observes real page boundaries.
const makeSeekDelegate = (rows: Row[]): AnyDelegate =>
  ({
    findMany: async (args: Record<string, unknown>) => {
      const keyset = (args.where as { AND?: [unknown, { OR?: { id?: { gt?: string } }[] }] }).AND?.[1]?.OR?.[0]?.id?.gt;
      const after = keyset ? rows.filter((row) => row.id > keyset) : rows;
      return after.slice(0, args.take as number);
    },
    count: async () => rows.length,
  }) as unknown as AnyDelegate;

const cursorContext = (filterLens: LensNarrowing, query: Record<string, unknown>) =>
  makeContext(filterLens, query) as unknown as Parameters<typeof cursorPaginate>[0];

describe('cursorPaginate — filter binding', () => {
  const userLens: LensNarrowing = { parent: lensFor('User'), root: { picks: ['name'] } };
  const rows: Row[] = ['u-1', 'u-2', 'u-3', 'u-4', 'u-5'].map((id) => ({ id }));

  it('walks page two with a cursor minted under the same filter', async () => {
    const first = await cursorPaginate(cursorContext(userLens, { pageSize: 2 }), makeSeekDelegate(rows), {
      where: { name: 'aron' },
    });
    expect(first.data).toEqual([{ id: 'u-1' }, { id: 'u-2' }]);
    expect(first.pagination.hasMore).toBe(true);

    const second = await cursorPaginate(
      cursorContext(userLens, { pageSize: 2, cursor: first.pagination.nextCursor }),
      makeSeekDelegate(rows),
      { where: { name: 'aron' } },
    );
    expect(second.data).toEqual([{ id: 'u-3' }, { id: 'u-4' }]);
  });

  // why: the cursor is only meaningful inside the sequence it was minted from. Replaying it
  // why: under a different filter seeks into a different sequence and silently skips rows.
  it('rejects a cursor minted under a different filter with a 400', async () => {
    const first = await cursorPaginate(cursorContext(userLens, { pageSize: 2 }), makeSeekDelegate(rows), {
      where: { name: 'aron' },
    });

    const replay = cursorPaginate(
      cursorContext(userLens, { pageSize: 2, cursor: first.pagination.nextCursor }),
      makeSeekDelegate(rows),
      { where: { name: 'sam' } },
    );
    await expect(replay).rejects.toThrow(AppError);
    await expect(replay).rejects.toThrow('Pagination cursor does not match the requested filter');
  });

  it('a search term is part of the filter the cursor is bound to', async () => {
    const first = await cursorPaginate(
      cursorContext(userLens, { pageSize: 2, search: 'acme' }),
      makeSeekDelegate(rows),
    );

    await expect(
      cursorPaginate(
        cursorContext(userLens, { pageSize: 2, cursor: first.pagination.nextCursor }),
        makeSeekDelegate(rows),
      ),
    ).rejects.toThrow('Pagination cursor does not match the requested filter');
  });
});
