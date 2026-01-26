import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { mutationLifeCycleExtension } from '@template/db/extensions/mutationLifeCycle';
import { PrismaClient } from '@template/db/generated/client/client';

type AfterCommitFn = () => Promise<void> | void;

type StoreData = {
  txn: ExtendedPrismaClient | null;
  scopeId: string | null;
  afterCommitBatches: AfterCommitFn[][];
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

  scope: async <T>(scopeId: string | undefined, fn: () => Promise<T>): Promise<T> => {
    if (store.getStore()) return fn();
    return store.run({ txn: null, scopeId: scopeId ?? null, afterCommitBatches: [] }, fn);
  },

  txn: async <T>(fn: () => Promise<T>): Promise<T> => {
    const existing = store.getStore();
    if (existing?.txn) return fn();

    const s = existing ?? { txn: null, scopeId: crypto.randomUUID(), afterCommitBatches: [] };

    const run = async () => {
      try {
        const result = await db.raw.$transaction(async (t) => {
          s.txn = t as ExtendedPrismaClient;
          try { return await fn(); }
          finally { s.txn = null; }
        });

        // Only run afterCommit callbacks if transaction succeeded
        for (const batch of s.afterCommitBatches) await Promise.all(batch.map((cb) => cb()));
        return result;
      } finally {
        // Always clear callbacks (prevents stale callbacks on failed txn)
        s.afterCommitBatches = [];
      }
    };

    return existing ? run() : store.run(s, run);
  },

  onCommit: (callbacks: AfterCommitFn | AfterCommitFn[]): void => {
    const s = store.getStore();
    if (!s) throw new Error('db.onCommit() requires db.scope() or db.txn()');
    s.afterCommitBatches.push(Array.isArray(callbacks) ? callbacks : [callbacks]);
  },

  getScopeId: (): string | null => store.getStore()?.scopeId ?? null,

  isInTxn: (): boolean => !!store.getStore()?.txn,
};

type Db = ExtendedPrismaClient & typeof dbMethods;

export const db: Db = new Proxy({} as Db, {
  get(_, prop: string) {
    if (prop in dbMethods) return (dbMethods as Record<string, unknown>)[prop];
    return ((store.getStore()?.txn ?? db.raw) as Record<string, unknown>)[prop];
  },
});
