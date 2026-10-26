/**
 * @atlas
 * @kind helper
 * @partOf primitive:requestContext
 * @uses none
 */
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const me = (c: Context<AppEnv>) => {
  const token = c.get('token');
  return c.get('user') ?? (token?.ownerModel === 'User' ? token.user : null);
};
