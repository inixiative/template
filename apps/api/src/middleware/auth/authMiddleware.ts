/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses none
 */
import type { Context, Next } from 'hono';
import { auth } from '#/lib/auth';
import { setUserContext } from '#/lib/context/setUserContext';
import { findUserWithRelations } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export const authMiddleware = async (c: Context<AppEnv>, next: Next) => {
  // Skip if context already set from batch
  if (c.get('user')) return next();

  const headers = new Headers(c.req.raw.headers);
  headers.delete('cookie');

  // Fall back to URL token if no auth header (for WebSocket, email links, etc.)
  const urlToken = new URL(c.req.url).searchParams.get('token');
  if (urlToken && !headers.get('authorization')) headers.set('authorization', `Bearer ${urlToken}`);

  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) return next();

  const user = await findUserWithRelations(session.user.id);
  if (!user) return next();

  await setUserContext(c, user);
  await next();
};
