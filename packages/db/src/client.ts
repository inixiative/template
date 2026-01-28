import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { resolveAll, getConcurrency, type ConcurrencyType } from '@template/shared/utils';
import { mutationLifeCycleExtension } from '@template/db/extensions/mutationLifeCycle';
import { PrismaClient } from '@template/db/generated/client/client';

type AfterCommitFn = () => Promise<void> | void;
type CommitBatch = { fns: AfterCommitFn[]; concurrency?: number; types?: ConcurrencyType[] };
type ScopeContext = 'api' | 'worker';

type StoreData = {
  txn: ExtendedPrismaClient | null;
  scopeId: string | null;
  scopeContext: ScopeContext | null;
  afterCommitBatches: CommitBatch[];
};

const store = new AsyncLocalStorage<StoreData>();

const createClient = () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter, log: ['error'] });
  return prisma.$extends(mutationLifeCycleExtension());
};

export type ExtendedPrismaClient = ReturnType<typeof createClient>;

let raw: ExtendedPrismaClient | null = null;

const dbMethods = {
  get raw() { return raw ??= createClient(); },

  scope: async <T>(scopeId: string | undefined, fn: () => Promise<T>, context?: ScopeContext): Promise<T> => {
    if (store.getStore()) return fn();
    return store.run({ txn: null, scopeId: scopeId ?? null, scopeContext: context ?? null, afterCommitBatches: [] }, fn);
  },

  txn: async <T>(fn: () => Promise<T>, options?: { timeout?: number }): Promise<T> => {
    const existing = store.getStore();
    if (existing?.txn) return fn();

    const s = existing ?? { txn: null, scopeId: crypto.randomUUID(), scopeContext: null, afterCommitBatches: [] };

    const run = async () => {
      try {
        const result = await db.raw.$transaction(
          async (t) => {
            s.txn = t as ExtendedPrismaClient;
            try { return await fn(); }
            finally { s.txn = null; }
          },
          options?.timeout ? { timeout: options.timeout } : undefined,
        );

        // Run afterCommit callbacks with concurrency limits.
        // This timing is separate from mutation timing in mutationLifeCycle.ts:
        // - "[db] slow mutation:" = hooks + query (inside txn)
        // - "[db] afterCommit slow:" = callbacks only (after commit)
        const totalCallbacks = s.afterCommitBatches.reduce((sum, b) => sum + b.fns.length, 0);
        if (totalCallbacks > 0) {
          const start = performance.now();
          for (const batch of s.afterCommitBatches) {
            await resolveAll(batch.fns, batch.concurrency);
          }
          const duration = performance.now() - start;
          const slowThreshold = s.scopeContext === 'worker' ? 30000 : 5000;
          if (duration > slowThreshold) {
            const types = [...new Set(s.afterCommitBatches.flatMap((b) => b.types ?? []))];
            console.warn(
              `[db] afterCommit slow: ${totalCallbacks} callbacks (${types.join(', ') || 'untyped'}) ` +
              `took ${(duration / 1000).toFixed(2)}s [${s.scopeContext ?? 'unknown'}: ${s.scopeId}]`,
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
    const fns = Array.isArray(callbacks) ? callbacks : [callbacks];
    const typeArray = types ? (Array.isArray(types) ? types : [types]) : undefined;
    s.afterCommitBatches.push({ fns, concurrency: getConcurrency(typeArray), types: typeArray });
  },

  getScopeId: (): string | null => store.getStore()?.scopeId ?? null,

  getScopeContext: (): ScopeContext | null => store.getStore()?.scopeContext ?? null,

  isInTxn: (): boolean => !!store.getStore()?.txn,
};

type Db = ExtendedPrismaClient & typeof dbMethods;

export const db: Db = new Proxy({} as Db, {
  get(_, prop: string) {
    if (prop in dbMethods) return (dbMethods as Record<string, unknown>)[prop];
    return ((store.getStore()?.txn ?? db.raw) as Record<string, unknown>)[prop];
  },
});
