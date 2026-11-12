import type { Db } from './client';

export const hydrate = (db: Db, id: string) => db.user.findUnique({ where: { id } });
