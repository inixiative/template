import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getUser } from '#/lib/context/getUser';
import type { AppEnv } from '#/types/appEnv';

export const validateUser = async (c: Context<AppEnv>, next: Next) => {
  if (!getUser(c)) throw new HTTPException(401, { message: 'Authentication required' });
  await next();
};
