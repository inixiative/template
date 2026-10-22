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
  executeHooks,
  type HookOptions,
  HookTiming,
} from '@template/db/extensions/hookRegistry';
import { getCurrentTransaction } from '@template/db/extensions/transactionRegistry';
import type { Prisma } from '@template/db/generated/client/client';
import { pickColumns } from '@template/db/utils/pickColumns';

// Hooks run on a Prisma continuation where the caller's async-local storage has not survived, so
// they get the caller's context re-entered around them rather than passed in. See
// runInBridgedContext in extensions/hookRegistry.ts.
const runHooks = (
  openTransaction: OpenTransaction,
  timing: HookTiming,
  hookOptions: HookOptions,
): Promise<void> =>
  require('@template/db/client').runInTransactionContext(openTransaction, () =>
    executeHooks(timing, hookOptions),
  );

export type MutationArgs = {
  data?: unknown;
  where?: Record<string, unknown>;
  create?: unknown;
  update?: unknown;
};

type MutationParams = {
  model: Prisma.ModelName;
  operation: string;
  args: MutationArgs;
  query: (args: MutationArgs) => Promise<unknown>;
};

type Interception = {
  loadPrevious?: (
    openTransaction: OpenTransaction,
    model: Prisma.ModelName,
    where: Record<string, unknown>,
  ) => Promise<unknown>;
};

const columnsOf = (model: Prisma.ModelName, result: unknown) =>
  Array.isArray(result)
    ? result.map((row) => pickColumns(model, row))
    : pickColumns(model, result as Record<string, unknown>);

export const intercept =
  (action: DbAction, { loadPrevious }: Interception = {}) =>
  async (params: MutationParams) => {
    const { model, operation, args, query } = params;
    const openTransaction = getCurrentTransaction(model, operation, params);
    if (!openTransaction) return query(args);
    assertNoNestedWrites(model, args);
    const hookOptions = { model, operation, action, args } as HookOptions;
    const where = args.where as Record<string, unknown>;
    if (loadPrevious)
      hookOptions.previous = (await loadPrevious(openTransaction, model, where)) as never;
    await runHooks(openTransaction, HookTiming.before, hookOptions);
    const result = await query(args);
    hookOptions.result = (
      action === DbAction.deleteMany ? hookOptions.previous : columnsOf(model, result)
    ) as never;
    await runHooks(openTransaction, HookTiming.after, hookOptions);
    return result;
  };
