import type { Context } from 'hono';
import { getUser } from '#/lib/context/getUser';
import type { AppEnv } from '#/types/appEnv';

export const isSuperadmin = (c: Context<AppEnv>): boolean => {
  return getUser(c)?.platformRole === 'superadmin';
};
