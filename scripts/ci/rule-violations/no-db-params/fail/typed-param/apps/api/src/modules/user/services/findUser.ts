import type { Db } from '@template/db';

export const findUser = async (client: Db, id: string) => client.user.findUnique({ where: { id } });
