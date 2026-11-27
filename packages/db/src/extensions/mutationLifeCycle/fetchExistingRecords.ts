/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { OpenTransaction } from '@template/db/clientTypes';
import type { Prisma } from '@template/db/generated/client/client';
import { modelDelegate } from '@template/db/utils/modelDelegate';

export const fetchExistingRecord = async (
  openTransaction: OpenTransaction,
  model: Prisma.ModelName,
  where: Record<string, unknown>,
) => (await modelDelegate(openTransaction.client, model).findUnique({ where })) ?? undefined;

export const fetchExistingRecords = (
  openTransaction: OpenTransaction,
  model: Prisma.ModelName,
  where: Record<string, unknown>,
) => modelDelegate(openTransaction.client, model).findMany({ where });
