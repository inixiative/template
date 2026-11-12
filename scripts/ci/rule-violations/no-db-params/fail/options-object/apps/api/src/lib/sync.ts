import type { Db } from '@template/db';

export const sync = (options: { client: Db; id: string }) => options.client.user.count();
