import { Elysia } from 'elysia';
import { cache } from 'src/shared/cache';
import type { Prisma } from '@prisma/client';

const USER_CACHE_TTL = 3600; // 1 hour

export const userContext = new Elysia({ name: 'userContext' })
  .derive(async ({ auth, db, redis }) => {
    if (!auth?.user) return { user: null };
    
    const user = await cache<Prisma.UserGetPayload<{ include: { accounts: true } }> | null>(
      redis.cache,
      `user:${auth.user.id}`,
      async () => {
        return db.user.findUnique({
          where: { id: auth.user.id },
          include: {
            accounts: true
          }
        });
      },
      USER_CACHE_TTL
    );
    
    return { user };
  })
  .macro(({ onBeforeHandle }) => ({
    requireAuth(required: boolean = false) {
      if (!required) return;
      
      onBeforeHandle(({ user, error }) => {
        if (!user) return error(401, { error: 'Unauthorized', message: 'You are not logged in' });
      });
    }
  }));