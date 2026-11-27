/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { DbAction } from '@template/db/extensions/hookRegistry';
import type { MutationParams } from '@template/db/extensions/mutationLifeCycle/makeMutationLifecycleInterceptor';
import { openTransactionForPrismaQueryOrThrow } from '@template/db/extensions/transactionRegistry';
import { modelDelegate } from '@template/db/utils/modelDelegate';

export const makeBulkWriteCountInterceptor =
  (bulkAction: DbAction.createManyAndReturn | DbAction.updateManyAndReturn) =>
  async (params: MutationParams) => {
    const { model, operation, args, query } = params;
    const openTransaction = openTransactionForPrismaQueryOrThrow(model, operation, params);
    if (!openTransaction) return query(args);
    const rows = await modelDelegate(openTransaction.client, model)[bulkAction](args as never);
    return { count: rows.length };
  };
