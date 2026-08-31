/**
 * @atlas
 * @kind client
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import type { AfterCommitFn, Db, OpenTransaction, Scope, ScopeContext } from '@template/db/clientTypes';
import { assertNoNestedWrites } from '@template/db/extensions/assertNoNestedWrites';
import { captureBridgedContext, hasHooksFor, runInBridgedContext } from '@template/db/extensions/hookRegistry';
import { mutationLifeCycleExtension } from '@template/db/extensions/mutationLifeCycle';
import { softDeleteScopeExtension } from '@template/db/extensions/softDeleteScopeExtension';
import {
  closeTransactionRegistration,
  openTransactionRegistration,
  registrationProbe,
} from '@template/db/extensions/transactionRegistry';
import { Prisma, PrismaClient } from '@template/db/generated/client/client';
import { prismaMap } from '@template/db/generated/prismaMap';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { type ModelName, toModelName } from '@template/db/utils/modelNames';
import { LogScope, log } from '@template/shared/logger';
import { type ConcurrencyType, getConcurrency, resolveAll } from '@template/shared/utils';
import { castArray } from 'lodash-es';

const store = new AsyncLocalStorage<Scope>();

const newScope = (scopeId: string | null, scopeContext: ScopeContext | null): Scope => ({
  scopeId,
  scopeContext,
  openTransaction: null,
});

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
  const prisma = new PrismaClient({ adapter, log: ['error'], transactionOptions: { timeout: 30_000 } });
  // You would add read replicas here via additional $extends
  return prisma.$extends(mutationLifeCycleExtension()).$extends(softDeleteScopeExtension()) as unknown as Db;
};

const dbMethods = {
  get raw() {
    if (!__raw) __raw = createClient();
    return __raw;
  },

  scope: async <T>(scopeId: string | undefined, fn: () => Promise<T>, context?: ScopeContext): Promise<T> => {
    if (store.getStore()) return fn();
    // Await inside the store — a returned lazy thenable would otherwise execute after the scope exits.
    return store.run(newScope(scopeId ?? null, context ?? null), async () => await fn());
  },

  txn: async <T>(fn: () => Promise<T>, options?: { timeout?: number }): Promise<T> => {
    const existing = store.getStore();
    if (existing?.openTransaction) return fn();

    const scope = existing ?? newScope(crypto.randomUUID(), null);
    // The caller frame is the last point at which async-local storage is reliable.
    const bridgedContext = captureBridgedContext();

    const run = async () => {
      const { result, openTransaction } = await db.raw.$transaction(
        async (transactionClient) => {
          const openTransaction: OpenTransaction = {
            scope,
            client: transactionClient as Db,
            prismaTransactionId: null,
            afterCommitBatches: [],
            bridgedContext,
          };
          scope.openTransaction = openTransaction;
          const registrationToken = openTransactionRegistration(openTransaction);
          try {
            // Tells the mutation extension which Prisma transaction id belongs to this transaction;
            // a write it cannot match to a registration is one db.txn() did not open.
            await openTransaction.client[registrationProbe.model].findFirst({
              where: { [registrationProbe.field]: registrationToken },
            });
            if (!openTransaction.prismaTransactionId) {
              throw new Error(
                'db.txn() failed to register its transaction with the mutation extension — the mutationLifeCycle extension is missing from this client',
              );
            }
            return { result: await fn(), openTransaction };
          } finally {
            closeTransactionRegistration(registrationToken, openTransaction);
            scope.openTransaction = null;
          }
        },
        options?.timeout ? { timeout: options.timeout } : undefined,
      );

      // Batches belong to this transaction, so a nested db.txn (e.g. a mutation from inside an
      // onCommit handler) drains its own and a rollback discards these with the object.
      const batches = openTransaction.afterCommitBatches;
      const totalCallbacks = batches.reduce((sum, b) => sum + b.fns.length, 0);
      if (totalCallbacks > 0) {
        const start = performance.now();
        for (const batch of batches) {
          const results = await db.parallel(
            batch.fns.map((fn) => () => Promise.resolve(fn())),
            { concurrency: batch.concurrency, resolution: 'allSettled' },
          );

          throwIfFailures(
            'db.onCommit() callback failed',
            results.filter((result) => result.status === 'rejected').map((result) => result.reason),
          );
        }
        const duration = performance.now() - start;
        const slowThreshold = scope.scopeContext === 'worker' ? 30000 : 5000;
        if (duration > slowThreshold) {
          const types = [...new Set(batches.flatMap((b) => b.types ?? []))];
          log.warn(
            `afterCommit slow: ${totalCallbacks} callbacks (${types.join(', ') || 'untyped'}) took ${(duration / 1000).toFixed(2)}s`,
            LogScope.db,
          );
        }
      }
      return result;
    };

    return existing ? run() : store.run(scope, run);
  },

  onCommit: (callbacks: AfterCommitFn | AfterCommitFn[], types?: ConcurrencyType | ConcurrencyType[]): void => {
    const openTransaction = store.getStore()?.openTransaction;
    if (!openTransaction) throw new Error('db.onCommit() requires db.txn()');
    const callbackList = castArray(callbacks);
    const typeList = types ? castArray(types) : undefined;
    openTransaction.afterCommitBatches.push({
      fns: callbackList,
      concurrency: getConcurrency(typeList),
      types: typeList,
    });
  },

  parallel: async <T>(
    thunks: Array<() => Promise<T>>,
    options?: { concurrency?: number; resolution?: 'all' | 'allSettled' },
  ): Promise<T[] | PromiseSettledResult<T>[]> => {
    if (dbMethods.isInTxn()) {
      throw new Error(
        'db.parallel() cannot run inside a transaction — each branch runs in its own scope/txn, which would break the outer transaction atomicity',
      );
    }
    const parent = store.getStore();
    const inOwnScope = (thunk: () => Promise<T>) =>
      store.run(newScope(crypto.randomUUID(), parent?.scopeContext ?? null), thunk);
    if (options?.resolution === 'allSettled') {
      return resolveAll(
        thunks.map((thunk) => async (): Promise<PromiseSettledResult<T>> => {
          try {
            return { status: 'fulfilled', value: await inOwnScope(thunk) };
          } catch (reason) {
            return { status: 'rejected', reason };
          }
        }),
        options.concurrency,
      );
    }
    return resolveAll(
      thunks.map((thunk) => () => inOwnScope(thunk)),
      options?.concurrency,
    );
  },

  withDeleted: <T>(fn: () => T | Promise<T>): Promise<Awaited<T>> => auditActorContext.withSoftDeleteBypass(fn),

  getScopeId: (): string | null => store.getStore()?.scopeId ?? null,

  getScope: (): ScopeContext | null => store.getStore()?.scopeContext ?? null,

  isInTxn: (): boolean => !!store.getStore()?.openTransaction,

  // Raw SELECT * FOR UPDATE — scalar columns only, no relations/includes; load related data separately.
  findForUpdate: <T = unknown>(model: ModelName, where: Record<string, unknown>): Promise<T[]> => {
    if (!dbMethods.isInTxn()) throw new Error('db.findForUpdate() requires db.txn()');
    const keys = Object.keys(where);
    if (!keys.length) throw new Error('db.findForUpdate() requires at least one predicate');
    const table = prismaMap.models[model]?.dbName ?? model;
    const conds = keys.map((key) => {
      const value = where[key];
      if (value !== null && typeof value === 'object' && 'in' in (value as Record<string, unknown>)) {
        const list = (value as { in: unknown[] }).in;
        if (!Array.isArray(list) || !list.length)
          throw new Error(`db.findForUpdate() requires a non-empty in-list for '${key}'`);
        return Prisma.sql`${Prisma.raw(`"${key}"`)} IN (${Prisma.join(
          list.map((item) => Prisma.sql`${item}`),
          ', ',
        )})`;
      }
      return Prisma.sql`${Prisma.raw(`"${key}"`)} = ${value}`;
    });
    return db.$queryRaw<T[]>(
      Prisma.sql`SELECT * FROM ${Prisma.raw(`"${table}"`)} WHERE ${Prisma.join(conds, ' AND ')} FOR UPDATE`,
    );
  },
};

// Re-enters the caller's scope first, so the ambient db proxy resolves to the executing transaction
// for the whole callee subtree, then each provider's captured context inside it.
export const runInTransactionContext = <T>(openTransaction: OpenTransaction, fn: () => T): T =>
  store.run(openTransaction.scope, () => runInBridgedContext(openTransaction.bridgedContext, fn));

// A bare hooked mutation opens its db.txn here, in the caller's frame, where async-local storage
// is still reliable; db.raw skips the whole life cycle.
const HOOKED_MUTATION_OPS = new Set([
  'create',
  'createManyAndReturn',
  'update',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

const bareDelegates = new Map<string | symbol, unknown>();

const bareDelegate = (model: string | symbol): unknown => {
  const cached = bareDelegates.get(model);
  if (cached) return cached;

  const target = (db.raw as unknown as Record<string | symbol, unknown>)[model];
  const modelName = typeof model === 'string' ? toModelName(model) : undefined;
  if (!target || typeof target !== 'object' || !modelName) return target;

  const delegate = new Proxy(target as Record<string, unknown>, {
    get(t, op) {
      const member = t[op as string];
      if (typeof member !== 'function' || !HOOKED_MUTATION_OPS.has(op as string)) return member;
      return async (args: unknown) => {
        if (!hasHooksFor(modelName)) {
          assertNoNestedWrites(modelName, args);
          return (member as (a: unknown) => Promise<unknown>).call(t, args);
        }
        return dbMethods.txn(() => {
          const live = (db as unknown as Record<string | symbol, Record<string, (a: unknown) => Promise<unknown>>>)[
            model
          ];
          return live[op as string]!(args);
        });
      };
    },
  });
  bareDelegates.set(model, delegate);
  return delegate;
};

export const db: Db = new Proxy({} as Db, {
  get(_, prop: string) {
    if (prop in dbMethods) return (dbMethods as Record<string, unknown>)[prop];
    const openTransaction = store.getStore()?.openTransaction;
    if (openTransaction) return (openTransaction.client as unknown as Record<string, unknown>)[prop];
    return bareDelegate(prop);
  },
});
