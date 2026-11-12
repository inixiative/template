import type { Db } from '@template/db';

export const findUser = ({ db, id }: { db: Db; id: string }) => db.user.findUnique({ where: { id } });
