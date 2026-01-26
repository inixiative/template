import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getUser } from '#/lib/context/getUser';
import type { AppEnv } from '#/types/appEnv';

export const validateSuperadmin = async (c: Context<AppEnv>, next: Next) => {
  if (getUser(c)?.platformRole !== 'superadmin') {
    throw new HTTPException(403, { message: 'Superadmin access required' });
  }
  await next();
};
