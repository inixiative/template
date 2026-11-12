/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { Prisma } from '@template/db/generated/client/client';

export const isPrismaNull = (value: unknown): boolean =>
  value === Prisma.DbNull || value === Prisma.JsonNull;

export const isCleared = (value: unknown): boolean =>
  value === undefined || value === null || isPrismaNull(value);
