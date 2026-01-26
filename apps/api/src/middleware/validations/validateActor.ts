import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getActor } from '#/lib/context/getActor';
import type { AppEnv } from '#/types/appEnv';

export const validateActor = async (c: Context<AppEnv>, next: Next) => {
  if (!getActor(c).user) throw new HTTPException(401, { message: 'Authentication required' });
  await next();
};
