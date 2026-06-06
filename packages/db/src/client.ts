import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import type { AfterCommitFn, Db, ScopeContext } from '@template/db/clientTypes';
import { mutationLifeCycleExtension } from '@template/db/extensions/mutationLifeCycle';
import { PrismaClient } from '@template/db/generated/client/client';
import { LogScope, log } from '@template/shared/logger';
import { type ConcurrencyType, getConcurrency, resolveAll } from '@template/shared/utils';
import { castArray } from 'lodash-es';

type CommitBatch = { fns: AfterCommitFn[]; concurrency?: number; types?: ConcurrencyType[] };

type StoreData = {
  txn: Db | null;
  scopeId: string | null;
  scopeContext: ScopeContext | null;
  afterCommitBatches: CommitBatch[];
};

const store = new AsyncLocalStorage<StoreData>();

let __raw: Db | null = null;

const throwIfFailures = (context: string, errors: unknown[]): void => {
  if (errors.length === 0) return;

  if (errors.length === 1) {
    const error = errors[0];
    throw error instanceof Error ? error : new Error(`${context}: ${String(error)}`);
  }

  throw new AggregateError(errors, `${context}: ${errors.length} callback failures`);
};

const createClient = (): Db => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter, log: ['error'] });
  // You would add read replicas here via additional $extends
  return prisma.$extends(mutationLifeCycleExtension()) as unknown as Db;
};

const dbMethods = {
  get raw() {
    if (!__raw) __raw = createClient();
    return __raw;
  },

  scope: async <T>(scopeId: string | undefined, fn: () => Promise<T>, context?: ScopeContext): Promise<T> => {
    if (store.getStore()) return fn();
    return store.run(
      { txn: null, scopeId: scopeId ?? null, scopeContext: context ?? null, afterCommitBatches: [] },
      fn,
    );
  },

  txn: async <T>(fn: () => Promise<T>, options?: { timeout?: number }): Promise<T> => {
    const existing = store.getStore();
    if (existing?.txn) return fn();

    const s = existing ?? { txn: null, scopeId: crypto.randomUUID(), scopeContext: null, afterCommitBatches: [] };

    const run = async () => {
      try {
        const result = await db.raw.$transaction(
          async (t) => {
            s.txn = t as Db;
            try {
              return await fn();
            } finally {
              s.txn = null;
            }
          },
          options?.timeout ? { timeout: options.timeout } : undefined,
        );

        // Drain afterCommit callbacks. Snapshot + reset the queue before
        // iteration so nested db.txn calls (e.g. mutations from inside an
        // onCommit handler) don't see the parent's pending batches and re-run
        // them. Nested mutations register their own onCommit batches against
        // the same scope state, but their own run() snapshots and drains
        // those before this loop continues — so we don't need a while loop.
        const batches = s.afterCommitBatches;
        s.afterCommitBatches = [];
        const totalCallbacks = batches.reduce((sum, b) => sum + b.fns.length, 0);
        if (totalCallbacks > 0) {
          const start = performance.now();
          for (const batch of batches) {
            const results = await resolveAll(
              batch.fns.map((fn) => async () => {
                try {
                  await fn();
                  return null;
                } catch (error) {
                  return error;
                }
              }),
              batch.concurrency,
            );

            throwIfFailures(
              'db.onCommit() callback failed',
              results.filter((result) => result !== null),
            );
          }
          const duration = performance.now() - start;
          const slowThreshold = s.scopeContext === 'worker' ? 30000 : 5000;
          if (duration > slowThreshold) {
            const types = [...new Set(batches.flatMap((b) => b.types ?? []))];
            log.warn(
              `afterCommit slow: ${totalCallbacks} callbacks (${types.join(', ') || 'untyped'}) took ${(duration / 1000).toFixed(2)}s`,
              LogScope.db,
            );
          }
        }
        return result;
      } finally {
        // Always clear callbacks (prevents stale callbacks on failed txn)
        s.afterCommitBatches = [];
      }
    };

    return existing ? run() : store.run(s, run);
  },

  onCommit: (callbacks: AfterCommitFn | AfterCommitFn[], types?: ConcurrencyType | ConcurrencyType[]): void => {
    const s = store.getStore();
    if (!s?.txn) throw new Error('db.onCommit() requires db.txn()');
    const fns = castArray(callbacks);
    const typeArray = types ? castArray(types) : undefined;
    s.afterCommitBatches.push({ fns, concurrency: getConcurrency(typeArray), types: typeArray });
  },

  getScopeId: (): string | null => store.getStore()?.scopeId ?? null,

  getScope: (): ScopeContext | null => store.getStore()?.scopeContext ?? null,

  isInTxn: (): boolean => !!store.getStore()?.txn,
};

export const db: Db = new Proxy({} as Db, {
  get(_, prop: string) {
    if (prop in dbMethods) return (dbMethods as Record<string, unknown>)[prop];
    return ((store.getStore()?.txn ?? db.raw) as unknown as Record<string, unknown>)[prop];
  },
});
