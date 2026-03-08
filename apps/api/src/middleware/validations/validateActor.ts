import type { Context, Next } from 'hono';
import { getActor } from '#/lib/context/getActor';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const validateActor = async (c: Context<AppEnv>, next: Next) => {
  if (!getActor(c).user) throw makeError({ status: 401, message: 'Authentication required' });
  await next();
};
