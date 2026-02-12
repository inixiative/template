import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const notFoundHandlerMiddleware = (c: Context<AppEnv>) => {
  c.header('Cache-Control', 'no-store');
  return makeError({
    status: 404,
    message: `Route ${c.req.method} ${c.req.path} not found`,
    requestId: c.get('requestId'),
  }).getResponse();
};
