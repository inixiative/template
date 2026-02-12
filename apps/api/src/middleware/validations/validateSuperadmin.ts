import type { Context, Next } from 'hono';
import { makeError } from '#/lib/errors';

import type { AppEnv } from '#/types/appEnv';

export const validateSuperadmin = async (c: Context<AppEnv>, next: Next) => {
  if (c.get('user')?.platformRole !== 'superadmin') {
    throw makeError({ status: 403, message: 'Superadmin access required', requestId: c.get('requestId') });
  }
  await next();
};
