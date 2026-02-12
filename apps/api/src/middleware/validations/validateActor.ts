import type { Context, Next } from 'hono';
import { makeError } from '#/lib/errors';
import { getActor } from '#/lib/context/getActor';
import type { AppEnv } from '#/types/appEnv';

export const validateActor = async (c: Context<AppEnv>, next: Next) => {
  if (!getActor(c).user) throw makeError({ status: 401, message: 'Authentication required', requestId: c.get('requestId') });
  await next();
};
