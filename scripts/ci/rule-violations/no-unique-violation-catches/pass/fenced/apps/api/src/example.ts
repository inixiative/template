import { db } from '@template/db';
import type { User } from '@template/db/generated/client/client';

export const ensureUser = (email: string) =>
  db.txn(async () => {
    const [existing] = await db.findForUpdate<User>('User', { email }, { upserting: true });
    return existing ?? db.user.create({ data: { email, name: email } });
  });
