import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getToken } from '#/lib/context/getToken';
import { getUser } from '#/lib/context/getUser';
import type { AppEnv } from '#/types/appEnv';

export const validateNotToken = async (c: Context<AppEnv>, next: Next) => {
  if (!getUser(c)) throw new HTTPException(401, { message: 'Authentication required' });
  if (getToken(c)) throw new HTTPException(403, { message: 'Tokens cannot perform this action' });
  await next();
};
