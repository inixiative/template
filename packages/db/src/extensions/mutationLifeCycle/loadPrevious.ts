/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { OpenTransaction } from '@template/db/clientTypes';
import type { Prisma } from '@template/db/generated/client/client';
import type { RuntimeDelegate } from '@template/db/utils/delegates';
import { type AccessorName, toAccessor } from '@template/db/utils/modelNames';

const txnDelegate = (openTransaction: OpenTransaction, model: string) =>
  (openTransaction.client as unknown as Record<AccessorName, RuntimeDelegate>)[toAccessor(model)];

export const fetchExistingRecord = async (
  openTransaction: OpenTransaction,
  model: Prisma.ModelName,
  where: Record<string, unknown>,
) => (await txnDelegate(openTransaction, model).findUnique({ where })) ?? undefined;

export const fetchExistingRecords = (
  openTransaction: OpenTransaction,
  model: Prisma.ModelName,
  where: Record<string, unknown>,
) => txnDelegate(openTransaction, model).findMany({ where });
