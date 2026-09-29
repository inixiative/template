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
import { getCurrentTransaction } from '@template/db/extensions/transactionRegistry';
import type { Prisma } from '@template/db/generated/client/client';

// Hooks run on a Prisma continuation where the caller's async-local storage has not survived, so
// they get the caller's context re-entered around them rather than passed in. See
// runInBridgedContext in extensions/hookRegistry.ts.
const runHooks = (openTransaction: OpenTransaction, timing: HookTiming, hookOptions: HookOptions): Promise<void> =>
  require('@template/db/client').runInTransactionContext(openTransaction, () => executeHooks(timing, hookOptions));

export type MutationArgs = { data?: unknown; where?: Record<string, unknown>; create?: unknown; update?: unknown };

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

export const intercept =
  (action: DbAction, { invariantData, loadPrevious }: Interception = {}) =>
  async (params: MutationParams) => {
    const { model, operation, args, query } = params;
    const openTransaction = getCurrentTransaction(model, operation, params);
    if (invariantData) await runInvariants(model, action as DbInvariantAction, invariantData(args));
    if (!openTransaction) return query(args);
    assertNoNestedWrites(model, args);
    const hookOptions = { model, operation, action, args } as HookOptions;
    const where = args.where as Record<string, unknown>;
    if (loadPrevious) hookOptions.previous = (await loadPrevious(openTransaction, model, where)) as never;
    await runHooks(openTransaction, HookTiming.before, hookOptions);
    const result = await query(args);
    hookOptions.result = (action === DbAction.deleteMany ? hookOptions.previous : result) as never;
    await runHooks(openTransaction, HookTiming.after, hookOptions);
    return result;
  };
