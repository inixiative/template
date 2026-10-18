import type { Db } from '@template/db';

export const check = (db: Db, subject: string) => db.user.count({ where: { id: subject } });
