/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { OpenTransaction } from '@template/db/clientTypes';
import type { RuntimeDelegate } from '@template/db/utils/delegates';
import { type AccessorName, toAccessor } from '@template/db/utils/modelNames';

export const transactionDelegate = (openTransaction: OpenTransaction, model: string) =>
  (openTransaction.client as unknown as Record<AccessorName, RuntimeDelegate>)[toAccessor(model)];
