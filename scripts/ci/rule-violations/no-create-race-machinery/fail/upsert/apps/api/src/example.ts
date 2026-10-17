import { db } from '@template/db';

export const ensureUser = (email: string) =>
  db.user.upsert({ where: { email }, create: { email, name: email }, update: {} });
