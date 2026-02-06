import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

import type { AppEnv } from '#/types/appEnv';

export const validateUser = async (c: Context<AppEnv>, next: Next) => {
  if (!c.get('user')) throw new HTTPException(401, { message: 'Authentication required' });
  await next();
};
