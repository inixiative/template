import { Elysia } from 'elysia';
import { PrismaClient } from '@prisma/client';
import type { User } from '@prisma/client';
import { Redis } from 'ioredis';
import type { Auth } from 'better-auth';

export type ElysiaApp = Elysia<'', {
  decorator: {
    redis: {
      cache: Redis;
      queue: Redis;
    };
  };
  store: {};
  derive: {
    db: PrismaClient;
    auth: Auth;
    user?: User;
  };
  resolve: {};
}>;