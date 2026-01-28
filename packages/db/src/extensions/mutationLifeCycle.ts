import { Prisma } from '@template/db/generated/client/client';
import { db } from '@template/db/client';
import { toDelegate } from '@template/db/utils/modelNames';
import { DbAction, HookTiming, executeHooks } from './hookRegistry';

export { DbAction, HookTiming, registerDbHook, executeHooks, clearHookRegistry } from './hookRegistry';
export type { HookFunction, HookOptions, SingleAction, ManyAction } from './hookRegistry';

const SLOW_MUTATION_THRESHOLD = 5000;

const fetchExistingRecord = (model: Prisma.ModelName, where: Record<string, unknown>) =>
  toDelegate(db.raw, model).findUnique({ where });

const fetchExistingRecords = (model: Prisma.ModelName, where: Record<string, unknown>) =>
  toDelegate(db.raw, model).findMany({ where });

/**
 * Times the mutation work (hooks + query) EXCLUDING afterCommit callbacks.
 * afterCommit has its own timing in client.ts with `[db] afterCommit slow:` logs.
 * This separation lets you distinguish slow queries from slow callbacks.
 */
const timed = async <T>(
  model: Prisma.ModelName,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  if (duration > SLOW_MUTATION_THRESHOLD) {
    console.warn(
      `[db] slow mutation: ${model}.${operation} took ${(duration / 1000).toFixed(2)}s ` +
        `[scope: ${db.getScopeId() ?? 'none'}]`,
    );
  }

  return result;
};

export const mutationLifeCycleExtension = () =>
  Prisma.defineExtension({
    name: 'mutationLifeCycle',
    query: {
      $allModels: {
        async create({ model, operation, args, query }) {
          const hookOptions: HookOptions = { model, operation, action: DbAction.create, args };
          return db.txn(() =>
            timed(model, operation, async () => {
              await executeHooks(HookTiming.before, hookOptions);
              const result = await query(args);
              hookOptions.result = result;
              await executeHooks(HookTiming.after, hookOptions);
              return result;
            }),
          );
        },

        async createMany({ model }) {
          throw new Error(
            `createMany is not supported - use createManyAndReturn instead for ${model}. ` +
              'This ensures hooks (webhooks, cache, validation) work correctly.',
          );
        },

        async createManyAndReturn({ model, operation, args, query }) {
          const hookOptions: HookOptions = { model, operation, action: DbAction.createManyAndReturn, args };
          return db.txn(() =>
            timed(model, operation, async () => {
              await executeHooks(HookTiming.before, hookOptions);
              const result = await query(args);
              hookOptions.result = result;
              await executeHooks(HookTiming.after, hookOptions);
              return result;
            }),
          );
        },

        async update({ model, operation, args, query }) {
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.update, args };
          return db.txn(() =>
            timed(model, operation, async () => {
              hookOptions.previous = (await fetchExistingRecord(model, where)) ?? undefined;
              await executeHooks(HookTiming.before, hookOptions);
              const result = await query(args);
              hookOptions.result = result;
              await executeHooks(HookTiming.after, hookOptions);
              return result;
            }),
          );
        },

        async updateMany({ model }) {
          throw new Error(
            `updateMany is not supported - use updateManyAndReturn instead for ${model}. ` +
              'This ensures hooks (webhooks, cache, validation) work correctly.',
          );
        },

        async updateManyAndReturn({ model, operation, args, query }) {
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.updateManyAndReturn, args };
          return db.txn(
            () =>
              timed(model, operation, async () => {
                const previous = await fetchExistingRecords(model, where);
                hookOptions.previous = previous;
                await executeHooks(HookTiming.before, hookOptions);
                const result = await query(args);
                hookOptions.result = result;
                await executeHooks(HookTiming.after, hookOptions);
                return result;
              }),
            { timeout: 30_000 },
          );
        },

        async upsert({ model, operation, args, query }) {
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.upsert, args };
          return db.txn(() =>
            timed(model, operation, async () => {
              hookOptions.previous = (await fetchExistingRecord(model, where)) ?? undefined;
              await executeHooks(HookTiming.before, hookOptions);
              const result = await query(args);
              hookOptions.result = result;
              await executeHooks(HookTiming.after, hookOptions);
              return result;
            }),
          );
        },

        async delete({ model, operation, args, query }) {
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.delete, args };
          return db.txn(() =>
            timed(model, operation, async () => {
              hookOptions.previous = (await fetchExistingRecord(model, where)) ?? undefined;
              await executeHooks(HookTiming.before, hookOptions);
              const result = await query(args);
              hookOptions.result = result;
              await executeHooks(HookTiming.after, hookOptions);
              return result;
            }),
          );
        },

        async deleteMany({ model, operation, args, query }) {
          const { where } = args as { where: Record<string, unknown> };
          const hookOptions: HookOptions = { model, operation, action: DbAction.deleteMany, args };
          return db.txn(
            () =>
              timed(model, operation, async () => {
                const previous = await fetchExistingRecords(model, where);
                hookOptions.previous = previous;
                await executeHooks(HookTiming.before, hookOptions);
                const result = await query(args);
                hookOptions.result = previous; // deleteMany returns count, so use previous as result for hooks
                await executeHooks(HookTiming.after, hookOptions);
                return result;
              }),
            { timeout: 30_000 },
          );
        },
      },
    },
  });
