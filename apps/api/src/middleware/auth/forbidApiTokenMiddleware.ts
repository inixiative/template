/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses primitive:errors
 */
import type { Context, Next } from 'hono';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const forbidApiTokenMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (c.get('token')) {
    throw makeError({
      status: 403,
      message: 'This action requires a signed-in user session, not an API token',
    });
  }
  await next();
};
