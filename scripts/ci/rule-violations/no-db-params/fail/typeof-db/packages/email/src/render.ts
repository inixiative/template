import { db } from '@template/db';

export const render = (client: typeof db) => client.user.count();
