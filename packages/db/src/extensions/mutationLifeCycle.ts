/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { OpenTransaction } from '@template/db/clientTypes';
import { assertNoNestedWrites } from '@template/db/extensions/assertNoNestedWrites';
import {
  DbAction,
  type DbInvariantAction,
  executeHooks,
  type HookOptions,
  HookTiming,
  runInvariants,
} from '@template/db/extensions/hookRegistry';
import { claimPendingRegistration, getCurrentTransaction } from '@template/db/extensions/transactionRegistry';
import { Prisma } from '@template/db/generated/client/client';
import { runtimeDelegate } from '@template/db/utils/delegates';
import { LogScope, log } from '@template/shared/logger';

export type {
  DbInvariant,
  DbInvariantAction,
  DbInvariantOptions,
  HookFunction,
  HookOptions,
  ManyAction,
  SingleAction,
} from '@template/db/extensions/hookRegistry';
export {
  clearHookRegistry,
  DbAction,
  executeHooks,
  HookTiming,
  registerDbHook,
  registerDbInvariant,
  unregisterDbHook,
  unregisterDbInvariant,
} from '@template/db/extensions/hookRegistry';

const SLOW_MUTATION_THRESHOLD = 5000;

// Hooks run on a Prisma continuation where the caller's async-local storage has not survived, so
// they get the caller's context re-entered around them rather than passed in. See
// runInBridgedContext in extensions/hookRegistry.ts.
const runHooks = (openTransaction: OpenTransaction, timing: HookTiming, hookOptions: HookOptions): Promise<void> =>
  require('@template/db/client').runInTransactionContext(openTransaction, () => executeHooks(timing, hookOptions));

type MutationArgs = { data?: unknown; where?: Record<string, unknown>; create?: unknown; update?: unknown };

type MutationParams = {
  model: Prisma.ModelName;
  operation: string;
  args: MutationArgs;
  query: (args: MutationArgs) => Promise<unknown>;
};

type Interception = {
  invariantData?: (args: MutationArgs) => unknown;
  loadPrevious?: (
    openTransaction: OpenTransaction,
    model: Prisma.ModelName,
    where: Record<string, unknown>,
  ) => Promise<unknown>;
};

const dataOf = (args: MutationArgs) => args.data;

export const mutationLifeCycleExtension = () => {
  const fetchExistingRecord = async (
    openTransaction: OpenTransaction,
    model: Prisma.ModelName,
    where: Record<string, unknown>,
  ) => (await runtimeDelegate(openTransaction.client, model).findUnique({ where })) ?? undefined;

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

  const intercept =
    (action: DbAction, { invariantData, loadPrevious }: Interception = {}) =>
    async (params: MutationParams) => {
      const { model, operation, args, query } = params;
      const openTransaction = getCurrentTransaction(model, operation, params);
      if (invariantData) await runInvariants(model, action as DbInvariantAction, invariantData(args));
      if (!openTransaction) return query(args);
      assertNoNestedWrites(model, args);
      const hookOptions = { model, operation, action, args } as HookOptions;
      return timed(model, operation, async () => {
        const where = args.where as Record<string, unknown>;
        if (loadPrevious) hookOptions.previous = (await loadPrevious(openTransaction, model, where)) as never;
        await runHooks(openTransaction, HookTiming.before, hookOptions);
        const result = await query(args);
        hookOptions.result = (action === DbAction.deleteMany ? hookOptions.previous : result) as never;
        await runHooks(openTransaction, HookTiming.after, hookOptions);
        return result;
      });
    };

  return Prisma.defineExtension({
    name: 'mutationLifeCycle',
    query: {
      $allModels: {
        async findFirst(params) {
          claimPendingRegistration(params);
          return params.query(params.args);
        },

        create: intercept(DbAction.create, { invariantData: dataOf }),

        async createMany({ model }) {
          throw new Error(
            `createMany is not supported - use createManyAndReturn instead for ${model}. ` +
              'This ensures hooks (webhooks, cache, validation) work correctly.',
          );
        },

        createManyAndReturn: intercept(DbAction.createManyAndReturn, { invariantData: dataOf }),

        update: intercept(DbAction.update, { invariantData: dataOf, loadPrevious: fetchExistingRecord }),

        async updateMany({ model }) {
          throw new Error(
            `updateMany is not supported - use updateManyAndReturn instead for ${model}. ` +
              'This ensures hooks (webhooks, cache, validation) work correctly.',
          );
        },

        updateManyAndReturn: intercept(DbAction.updateManyAndReturn, {
          invariantData: dataOf,
          loadPrevious: fetchExistingRecords,
        }),

        upsert: intercept(DbAction.upsert, {
          invariantData: ({ create, update }) => [create, update],
          loadPrevious: fetchExistingRecord,
        }),

        delete: intercept(DbAction.delete, { loadPrevious: fetchExistingRecord }),

        deleteMany: intercept(DbAction.deleteMany, { loadPrevious: fetchExistingRecords }),
      },
    },
  });
};
