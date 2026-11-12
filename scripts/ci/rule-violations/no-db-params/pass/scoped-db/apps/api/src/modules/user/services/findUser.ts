import { db } from '@template/db';
import type { Db } from '@template/db';

export type WorkerContext = { db: Db; jobId: string };

export const findUser = (id: string) => db.user.findUnique({ where: { id } });

export const handle = async (ctx: WorkerContext) => ctx.db.user.count();
