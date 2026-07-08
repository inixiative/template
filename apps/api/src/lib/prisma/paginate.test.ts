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

// paginate reads the context, it doesn't route — a bare object with the vars it
// touches (validated query, bracketQuery, filterLens, user) stands in for Hono.
const makeContext = (filterLens: LensNarrowing, query: Record<string, unknown> = {}) => {
  const vars: Record<string, unknown> = { filterLens, bracketQuery: {}, user: undefined };
  return {
    get: (key: string) => vars[key],
    req: { valid: () => query },
  } as unknown as Parameters<typeof paginate>[0];
};

describe('paginate — lens bindings', () => {
  it('resolves `{ bind }` tokens into the lens before building the where', async () => {
    const captured: Captured = {};
    const lens: LensNarrowing = {
      parent: lensFor('User'),
      root: { picks: [], where: { field: 'name', operator: 'equals', bind: 'who' } },
    };

    await paginate(makeContext(lens), makeDelegate(captured), { bindings: { who: 'aron' } });

    expect(captured.findManyArgs?.where).toEqual({
      AND: [{}, { AND: [{ name: { equals: 'aron' } }] }],
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

    expect(captured.findManyArgs?.where).toEqual({ AND: [{}, {}] });
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });
});
