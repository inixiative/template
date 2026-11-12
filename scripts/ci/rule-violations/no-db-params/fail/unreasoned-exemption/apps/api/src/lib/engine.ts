import type { Db } from '@template/db';

export const run = (db: Db) => db.user.count();
