import { db } from '@template/db';

export const run = () => db.user.count();
