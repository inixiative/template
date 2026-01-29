import type { Context, Next } from 'hono';
import { auth } from '#/lib/auth';
import { setUserContext } from '#/lib/context/setUserContext';
import { findUserWithOrganizationUsers } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user?.id) return next();

  const db = c.get('db');
  const user = await findUserWithOrganizationUsers(db, session.user.id);
  if (!user) return next();

  await setUserContext(c, user);
  await next();
}
