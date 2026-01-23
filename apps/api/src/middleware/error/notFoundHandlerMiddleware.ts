import type { AppEnv } from '@src/types/appEnv';
import type { Context } from 'hono';

export function notFoundHandlerMiddleware(c: Context<AppEnv>) {
  c.header('Cache-Control', 'no-store');
  return c.json(
    {
      error: 'Not Found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404,
  );
}
