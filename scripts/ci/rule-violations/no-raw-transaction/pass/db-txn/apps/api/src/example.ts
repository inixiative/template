import { db } from '@template/db';

export async function transfer(fromId: string, toId: string) {
  // Allowed: db.txn sets the store so both writes run on the one txn connection.
  await db.txn(async () => {
    await db.user.update({ where: { id: fromId }, data: { name: 'a' } });
    await db.user.update({ where: { id: toId }, data: { name: 'b' } });
  });
}
