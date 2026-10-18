import { Prisma } from './prisma';

export const findForUpdate = (table: string, where: Prisma.Sql) =>
  Prisma.sql`SELECT * FROM ${Prisma.raw(`"${table}"`)} WHERE ${where} FOR SHARE`;
