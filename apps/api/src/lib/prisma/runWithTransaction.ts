import type { Prisma } from '@template/db';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

/**
 * Runs a handler within a database transaction.
 * If a transaction already exists in context, reuses it (for nested calls).
 * Otherwise, creates a new transaction and stores it in context.
 *
 * @example
 * const result = await runWithTransaction(c, async (txn) => {
 *   await txn.user.create({ data: {...} });
 *   await txn.investment.create({ data: {...} });
 *   return { success: true };
 * });
 */
export async function runWithTransaction<T>(
  c: Context<AppEnv>,
  handler: (txn: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const db = c.get('db');
  const existingTxn = c.get('txn');

  // Reuse existing transaction if one is in progress
  if (existingTxn) {
    return handler(existingTxn);
  }

  // Create new transaction and store in context
  return db.$transaction(async (txn) => {
    c.set('txn', txn as Prisma.TransactionClient);
    try {
      return await handler(txn as Prisma.TransactionClient);
    } finally {
      c.set('txn', undefined);
    }
  });
}
