/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { OpenTransaction } from '@template/db/clientTypes';
import { transactionDelegate } from '@template/db/extensions/mutationLifeCycle/transactionDelegate';
import type { Prisma } from '@template/db/generated/client/client';

export const fetchExistingRecord = async (
  openTransaction: OpenTransaction,
  model: Prisma.ModelName,
  where: Record<string, unknown>,
) => (await transactionDelegate(openTransaction, model).findUnique({ where })) ?? undefined;

export const fetchExistingRecords = (
  openTransaction: OpenTransaction,
  model: Prisma.ModelName,
  where: Record<string, unknown>,
) => transactionDelegate(openTransaction, model).findMany({ where });
