import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';


import type { AppEnv } from '#/types/appEnv';

export const validateNotToken = async (c: Context<AppEnv>, next: Next) => {
  if (!c.get('user')) throw new HTTPException(401, { message: 'Authentication required' });
  if (c.get('token')) throw new HTTPException(403, { message: 'Tokens cannot perform this action' });
  await next();
};
