import { Elysia } from 'elysia';
import { PrismaClient } from '@prisma/client';
import { mutationLifeCycleExtension, registerDbHook, DbAction, HookTiming } from 'src/plugins/prisma/extensions/mutationLifeCycle';
import { clearCacheExtension } from 'src/plugins/prisma/extensions/clearCache';

const prismaClient = new PrismaClient();

registerDbHook('*', HookTiming.after, [DbAction.create, DbAction.update, DbAction.upsert, DbAction.delete], clearCacheExtension);

export const db = new Elysia({ name: 'db' })
  .decorate('db', prismaClient)
  .derive((context) => {
    const extendedClient = context.db.$extends(mutationLifeCycleExtension(context as any));
    return { db: extendedClient };
  })
  .onStop(async ({ db }) => {
    await db.$disconnect();
  });
