/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Db, OpenTransaction } from '@template/db/clientTypes';
import { assertNoNestedWrites } from '@template/db/extensions/assertNoNestedWrites';
import { DbAction, executeHooks, type HookOptions, HookTiming } from '@template/db/extensions/hookRegistry';
import { claimPendingRegistration, getCurrentTransaction } from '@template/db/extensions/transactionRegistry';
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

// Hooks run on a Prisma continuation where the caller's async-local storage has not survived, so
// they get the caller's context re-entered around them rather than passed in. See
// runInBridgedContext in extensions/hookRegistry.ts.
const runHooks = (openTransaction: OpenTransaction, timing: HookTiming, hookOptions: HookOptions): Promise<void> =>
  require('@template/db/client').runInTransactionContext(openTransaction, () => executeHooks(timing, hookOptions));

const runtimeDelegate = (client: Db, model: Prisma.ModelName): RuntimeDelegate =>
  client[toAccessor(model)] as unknown as RuntimeDelegate;

export const mutationLifeCycleExtension = () => {
  const fetchExistingRecord = (
    openTransaction: OpenTransaction,
    model: Prisma.ModelName,
    where: Record<string, unknown>,
  ) => runtimeDelegate(openTransaction.client, model).findUnique({ where });

  const fetchExistingRecords = (
    openTransaction: OpenTransaction,
    model: Prisma.ModelName,
    where: Record<string, unknown>,
  ) => runtimeDelegate(openTransaction.client, model).findMany({ where });

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
          const openTransaction = getCurrentTransaction(model, operation, params);
          if (!openTransaction) return query(args);
          assertNoNestedWrites(model, args);
          const hookOptions: HookOptions = { model, operation, action: DbAction.create, args };
          return timed(model, operation, async () => {
            await runHooks(openTransaction, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(openTransaction, HookTiming.after, hookOptions);
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
          const openTransaction = getCurrentTransaction(model, operation, params);
          if (!openTransaction) return query(args);
          assertNoNestedWrites(model, args);
          const hookOptions: HookOptions = { model, operation, action: DbAction.createManyAndReturn, args };
          return timed(model, operation, async () => {
            await runHooks(openTransaction, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(openTransaction, HookTiming.after, hookOptions);
            return result;
          });
        },

        async update(params) {
          const { model, operation, args, query } = params;
          const openTransaction = getCurrentTransaction(model, operation, params);
          if (!openTransaction) return query(args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.update, args };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(openTransaction, model, where)) ?? undefined;
            await runHooks(openTransaction, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(openTransaction, HookTiming.after, hookOptions);
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
          const openTransaction = getCurrentTransaction(model, operation, params);
          if (!openTransaction) return query(args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.updateManyAndReturn, args };
          return timed(model, operation, async () => {
            hookOptions.previous = await fetchExistingRecords(openTransaction, model, where);
            await runHooks(openTransaction, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(openTransaction, HookTiming.after, hookOptions);
            return result;
          });
        },

        async upsert(params) {
          const { model, operation, args, query } = params;
          const openTransaction = getCurrentTransaction(model, operation, params);
          if (!openTransaction) return query(args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.upsert, args };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(openTransaction, model, where)) ?? undefined;
            await runHooks(openTransaction, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(openTransaction, HookTiming.after, hookOptions);
            return result;
          });
        },

        async delete(params) {
          const { model, operation, args, query } = params;
          const openTransaction = getCurrentTransaction(model, operation, params);
          if (!openTransaction) return query(args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.delete, args };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(openTransaction, model, where)) ?? undefined;
            await runHooks(openTransaction, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await runHooks(openTransaction, HookTiming.after, hookOptions);
            return result;
          });
        },

        async deleteMany(params) {
          const { model, operation, args, query } = params;
          const openTransaction = getCurrentTransaction(model, operation, params);
          if (!openTransaction) return query(args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.deleteMany, args };
          return timed(model, operation, async () => {
            const previous = await fetchExistingRecords(openTransaction, model, where);
            hookOptions.previous = previous;
            await runHooks(openTransaction, HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = previous; // deleteMany returns count, so use previous as result for hooks
            await runHooks(openTransaction, HookTiming.after, hookOptions);
            return result;
          });
        },
      },
    },
  });
};
