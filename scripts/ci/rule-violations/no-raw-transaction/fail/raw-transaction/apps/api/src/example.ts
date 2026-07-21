import { db } from '@template/db';

export async function transfer(fromId: string, toId: string) {
  // Forbidden: raw $transaction bypasses db.txn's AsyncLocalStorage store, so the
  // mutationLifeCycle extension reissues each write into a separate transaction.
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: fromId }, data: { name: 'a' } });
    await tx.user.update({ where: { id: toId }, data: { name: 'b' } });
  });
}
