import { db } from '@template/db';

export const upsertInTest = (email: string) =>
  db.user.upsert({ where: { email }, create: { email, name: email }, update: {} });
