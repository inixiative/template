import { db, Prisma } from '@template/db';

export const claim = (id: string) =>
  db.$queryRaw(Prisma.sql`SELECT * FROM "Job" WHERE id = ${id} FOR UPDATE`);
