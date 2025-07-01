import { Elysia } from 'elysia';
import { auth } from 'src/plugins/auth';
import { db } from 'src/plugins/db';
import { redis } from 'src/plugins/redis';

export const plugins = (app: Elysia) => {
  if (process.env.DB_ENABLED) app.use(db);
  if (process.env.REDIS_ENABLED) app.use(redis);
  if (process.env.AUTH_ENABLED) app.use(auth);

  return app;
};
