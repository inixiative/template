import { db } from '@template/db';

// Takes the row FOR UPDATE through the primitive; a raw FOR SHARE would be refused.
/* SELECT ... FOR UPDATE */
export const claim = (id: string) =>
  db.txn(async () => {
    const [row] = await db.findForUpdate('Job', { id });
    return row;
  });

export const label = 'waiting for update';
