/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Db } from '@template/db/clientTypes';
import { assertNoNestedWrites } from '@template/db/extensions/assertNoNestedWrites';
import { DbAction, executeHooks, type HookOptions, HookTiming } from '@template/db/extensions/hookRegistry';
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
  unregisterDbHook,
} from '@template/db/extensions/hookRegistry';

const SLOW_MUTATION_THRESHOLD = 5000;

// Lazy import to avoid circular dependency at module load time
const getDb = (): Db => require('@template/db/client').db;

const runtimeDelegate = (db: Db, model: Prisma.ModelName): RuntimeDelegate =>
  db[toAccessor(model)] as unknown as RuntimeDelegate;

// Re-issue through db.txn so the write + hooks share the txn's connection atomically.
const reissueInTxn = (model: Prisma.ModelName, operation: string, args: unknown): Promise<unknown> =>
  getDb().txn(() =>
    (runtimeDelegate(getDb(), model) as unknown as Record<string, (a: unknown) => Promise<unknown>>)[operation](args),
  );

export const mutationLifeCycleExtension = () => {
  const fetchExistingRecord = (model: Prisma.ModelName, where: Record<string, unknown>) =>
    runtimeDelegate(getDb(), model).findUnique({ where });

  const fetchExistingRecords = (model: Prisma.ModelName, where: Record<string, unknown>) =>
    runtimeDelegate(getDb(), model).findMany({ where });

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
        async create({ model, operation, args, query }) {
          if (!getDb().isInTxn()) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const hookOptions: HookOptions = { model, operation, action: DbAction.create, args };
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

        async createManyAndReturn({ model, operation, args, query }) {
          if (!getDb().isInTxn()) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const hookOptions: HookOptions = { model, operation, action: DbAction.createManyAndReturn, args };
          return timed(model, operation, async () => {
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },

        async update({ model, operation, args, query }) {
          if (!getDb().isInTxn()) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.update, args };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(model, where)) ?? undefined;
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

        async updateManyAndReturn({ model, operation, args, query }) {
          if (!getDb().isInTxn()) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.updateManyAndReturn, args };
          return timed(model, operation, async () => {
            hookOptions.previous = await fetchExistingRecords(model, where);
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },

        async upsert({ model, operation, args, query }) {
          if (!getDb().isInTxn()) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.upsert, args };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(model, where)) ?? undefined;
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },

        async delete({ model, operation, args, query }) {
          if (!getDb().isInTxn()) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.delete, args };
          return timed(model, operation, async () => {
            hookOptions.previous = (await fetchExistingRecord(model, where)) ?? undefined;
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },

        async deleteMany({ model, operation, args, query }) {
          if (!getDb().isInTxn()) return reissueInTxn(model, operation, args);
          assertNoNestedWrites(model, args);
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.deleteMany, args };
          return timed(model, operation, async () => {
            const previous = await fetchExistingRecords(model, where);
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
