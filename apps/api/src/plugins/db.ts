import { Elysia } from 'elysia';
import { PrismaClient } from '@prisma/client';

export const db = new Elysia({ name: 'db' })
  .decorate('db', new PrismaClient())
  .onStop(async ({ db }) => {
    await db.$disconnect();
  });
