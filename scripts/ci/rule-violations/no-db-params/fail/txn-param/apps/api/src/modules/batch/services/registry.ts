import type { Prisma } from '@template/db';

export const register = (batchId: string, txn: Prisma.TransactionClient) => [batchId, txn];
