/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Db, HookDb, TransactionState } from '@template/db/clientTypes';
import { assertNoNestedWrites } from '@template/db/extensions/assertNoNestedWrites';
import { DbAction, executeHooks, type HookOptions, HookTiming } from '@template/db/extensions/hookRegistry';
import {
  claimTransactionRegistration,
  hookDbFor,
  pendingRegistrationToken,
  transactionStateFor,
} from '@template/db/extensions/transactionRegistry';
import { Prisma } from '@template/db/generated/client/client';
import type { RuntimeDelegate } from '@template/db/utils/delegates';
import { toAccessor } from '@template/db/utils/modelNames';
import { LogScope, log } from '@template/shared/logger';

export type { HookFunction, HookOptions, ManyAction, SingleAction } from '@template/db/extensions/hookRegistry';
export {
  clearHookRegistry,
  DbAction,
  executeHooks,
  HookTiming,
  registerDbHook,
} from '@template/db/extensions/hookRegistry';

const SLOW_MUTATION_THRESHOLD = 5000;

// Lazy import to avoid circular dependency at module load time
const getDb = (): Db => require('@template/db/client').db;

const runtimeDelegate = (client: Db | HookDb, model: Prisma.ModelName): RuntimeDelegate =>
  client[toAccessor(model)] as unknown as RuntimeDelegate;

// Re-issue through db.txn so the write + hooks share the txn's connection atomically.
const reissueInTxn = (model: Prisma.ModelName, operation: string, args: unknown): Promise<unknown> =>
  getDb().txn(() =>
    (runtimeDelegate(getDb(), model) as unknown as Record<string, (a: unknown) => Promise<unknown>>)[operation](args),
  );

type ExecutingTransaction = { kind: string; id: string | number };

// Prisma's public extension params do not say which transaction an op is executing on;
// __internalParams does, and unlike async-local storage it survives the interceptor's continuation.
// Pinned by transactionIdentity.test.ts.
export const readExecutingTransaction = (params: unknown): ExecutingTransaction | undefined =>
  (params as { __internalParams?: { transaction?: ExecutingTransaction } }).__internalParams?.transaction;

const resolveTransactionState = (
  model: Prisma.ModelName,
  operation: string,
  params: unknown,
): TransactionState | null => {
  const executingTransaction = readExecutingTransaction(params);
  if (!executingTransaction) return null;

  if (executingTransaction.kind === 'itx') {
    const transactionState = transactionStateFor(String(executingTransaction.id));
    if (transactionState) return transactionState;
  }

  throw new Error(
    `${model}.${operation} ran inside a transaction that db.txn() did not open. ` +
      'Hooked mutations must go through db.txn() — inside a raw $transaction their hooks and ' +
      'onCommit callbacks have no transaction to bind to.',
  );
};

export const mutationLifeCycleExtension = () => {
  const fetchExistingRecord = (hookDb: HookDb, model: Prisma.ModelName, where: Record<string, unknown>) =>
    runtimeDelegate(hookDb, model).findUnique({ where });

  const fetchExistingRecords = (hookDb: HookDb, model: Prisma.ModelName, where: Record<string, unknown>) =>
    runtimeDelegate(hookDb, model).findMany({ where });

  const timed = async <T>(model: Prisma.ModelName, operation: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    if (duration > SLOW_MUTATION_THRESHOLD) {
      log.warn(`slow mutation: ${model}.${operation} took ${(duration / 1000).toFixed(2)}s`, LogScope.db);
    }

    return result;
  };

  return Prisma.defineExtension({
    name: 'mutationLifeCycle',
    query: {
      $allModels: {
        async findFirst(params) {
          const registrationToken = pendingRegistrationToken(params.args);
          if (registrationToken) {
            const executingTransaction = readExecutingTransaction(params);
            if (executingTransaction?.kind === 'itx') {
              claimTransactionRegistration(registrationToken, String(executingTransaction.id));
            }
          }
          return params.query(params.args);
        },

        async create(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const hookDb = hookDbFor(transactionState);
          const hookOptions: HookOptions = { model, operation, action: DbAction.create, args, db: hookDb };
          return timed(model, operation, async () => {
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },

        async createMany({ model }) {
          throw new Error(
            `createMany is not supported - use createManyAndReturn instead for ${model}. ` +
              'This ensures hooks (webhooks, cache, validation) work correctly.',
          );
        },

        async createManyAndReturn(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const hookDb = hookDbFor(transactionState);
          const hookOptions: HookOptions = { model, operation, action: DbAction.createManyAndReturn, args, db: hookDb };
          return timed(model, operation, async () => {
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },

        async update(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookDb = hookDbFor(transactionState);
          const hookOptions: HookOptions = { model, operation, action: DbAction.update, args, db: hookDb };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(hookDb, model, where)) ?? undefined;
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },

        async updateMany({ model }) {
          throw new Error(
            `updateMany is not supported - use updateManyAndReturn instead for ${model}. ` +
              'This ensures hooks (webhooks, cache, validation) work correctly.',
          );
        },

        async updateManyAndReturn(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookDb = hookDbFor(transactionState);
          const hookOptions: HookOptions = { model, operation, action: DbAction.updateManyAndReturn, args, db: hookDb };
          return timed(model, operation, async () => {
            hookOptions.previous = await fetchExistingRecords(hookDb, model, where);
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },

        async upsert(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookDb = hookDbFor(transactionState);
          const hookOptions: HookOptions = { model, operation, action: DbAction.upsert, args, db: hookDb };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(hookDb, model, where)) ?? undefined;
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },

        async delete(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookDb = hookDbFor(transactionState);
          const hookOptions: HookOptions = { model, operation, action: DbAction.delete, args, db: hookDb };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(hookDb, model, where)) ?? undefined;
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },

        async deleteMany(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookDb = hookDbFor(transactionState);
          const hookOptions: HookOptions = { model, operation, action: DbAction.deleteMany, args, db: hookDb };
          return timed(model, operation, async () => {
            const previous = await fetchExistingRecords(hookDb, model, where);
            hookOptions.previous = previous;
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = previous; // deleteMany returns count, so use previous as result for hooks
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },
      },
    },
  });
};
