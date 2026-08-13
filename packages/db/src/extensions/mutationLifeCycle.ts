/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Db, TransactionState } from '@template/db/clientTypes';
import { assertNoNestedWrites } from '@template/db/extensions/assertNoNestedWrites';
import { DbAction, executeHooks, type HookOptions, HookTiming } from '@template/db/extensions/hookRegistry';
import {
  claimPendingRegistration,
  resolveTransactionState,
  transactionClient,
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

// Hooks run on a Prisma continuation where the caller's async-local storage has not survived, so
// they get the caller's context re-entered around them rather than passed in. See
// lib/transactionContext.ts.
const runHooks = (transactionState: TransactionState, timing: HookTiming, hookOptions: HookOptions): Promise<void> =>
  require('@template/db/client').runInTransactionContext(transactionState, () => executeHooks(timing, hookOptions));

const runtimeDelegate = (client: Db, model: Prisma.ModelName): RuntimeDelegate =>
  client[toAccessor(model)] as unknown as RuntimeDelegate;

// Re-issue through db.txn so the write + hooks share the txn's connection atomically.
const reissueInTxn = (model: Prisma.ModelName, operation: string, args: unknown): Promise<unknown> =>
  getDb().txn(() =>
    (runtimeDelegate(getDb(), model) as unknown as Record<string, (a: unknown) => Promise<unknown>>)[operation](args),
  );

export const mutationLifeCycleExtension = () => {
  const fetchExistingRecord = (
    transactionState: TransactionState,
    model: Prisma.ModelName,
    where: Record<string, unknown>,
  ) => runtimeDelegate(transactionClient(transactionState), model).findUnique({ where });

  const fetchExistingRecords = (
    transactionState: TransactionState,
    model: Prisma.ModelName,
    where: Record<string, unknown>,
  ) => runtimeDelegate(transactionClient(transactionState), model).findMany({ where });

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
          claimPendingRegistration(params);
          return params.query(params.args);
        },

        async create(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const hookOptions: HookOptions = { model, operation, action: DbAction.create, args };
          return timed(model, operation, async () => {
            await runHooks(transactionState, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(transactionState, HookTiming.after, hookOptions);
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
          const hookOptions: HookOptions = { model, operation, action: DbAction.createManyAndReturn, args };
          return timed(model, operation, async () => {
            await runHooks(transactionState, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(transactionState, HookTiming.after, hookOptions);
            return result;
          });
        },

        async update(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.update, args };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(transactionState, model, where)) ?? undefined;
            await runHooks(transactionState, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(transactionState, HookTiming.after, hookOptions);
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
          const hookOptions: HookOptions = { model, operation, action: DbAction.updateManyAndReturn, args };
          return timed(model, operation, async () => {
            hookOptions.previous = await fetchExistingRecords(transactionState, model, where);
            await runHooks(transactionState, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(transactionState, HookTiming.after, hookOptions);
            return result;
          });
        },

        async upsert(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.upsert, args };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(transactionState, model, where)) ?? undefined;
            await runHooks(transactionState, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(transactionState, HookTiming.after, hookOptions);
            return result;
          });
        },

        async delete(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.delete, args };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(transactionState, model, where)) ?? undefined;
            await runHooks(transactionState, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(transactionState, HookTiming.after, hookOptions);
            return result;
          });
        },

        async deleteMany(params) {
          const { model, operation, args, query } = params;
          const transactionState = resolveTransactionState(model, operation, params);
          if (!transactionState) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.deleteMany, args };
          return timed(model, operation, async () => {
            const previous = await fetchExistingRecords(transactionState, model, where);
            hookOptions.previous = previous;
            await runHooks(transactionState, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = previous; // deleteMany returns count, so use previous as result for hooks
            await runHooks(transactionState, HookTiming.after, hookOptions);
            return result;
          });
        },
      },
    },
  });
};
