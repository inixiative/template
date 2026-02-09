import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const notFoundHandlerMiddleware = (c: Context<AppEnv>) => {
  c.header('Cache-Control', 'no-store');
  return c.json({ error: 'Not Found', message: `Route ${c.req.method} ${c.req.path} not found` }, 404);
};
