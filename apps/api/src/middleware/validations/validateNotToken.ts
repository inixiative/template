import type { Context, Next } from 'hono';
import { makeError } from '#/lib/errors';

import type { AppEnv } from '#/types/appEnv';

export const validateNotToken = async (c: Context<AppEnv>, next: Next) => {
  if (!c.get('user')) throw makeError({ status: 401, message: 'Authentication required', requestId: c.get('requestId') });
  if (c.get('token')) throw makeError({ status: 403, message: 'Tokens cannot perform this action', requestId: c.get('requestId') });
  await next();
};
