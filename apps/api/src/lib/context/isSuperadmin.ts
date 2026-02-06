import type { Context } from 'hono';

import type { AppEnv } from '#/types/appEnv';

export const isSuperadmin = (c: Context<AppEnv>): boolean => {
  return c.get('user')?.platformRole === 'superadmin';
};
