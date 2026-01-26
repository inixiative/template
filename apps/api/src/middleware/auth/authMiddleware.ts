import type { Context, Next } from 'hono';
import { auth } from '#/lib/auth';
import { setUserContext } from '#/lib/context/setUserContext';
import { findUserByEmail, findUserWithOrganizationUsers } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

/**
 * Auth middleware - extracts session and user from request
 * Supports superadmin spoofing via `spoof-user-email` header
 */
export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) return next();

    const db = c.get('db');
    const user = await findUserWithOrganizationUsers(db, session.user.id);
    if (!user) return next();

    // Handle superadmin spoofing
    const spoofEmail = c.req.header('spoof-user-email')?.toLowerCase().trim();
    if (spoofEmail && user.platformRole === 'superadmin') {
      const spoofedBasic = await findUserByEmail(db, spoofEmail);
      if (spoofedBasic) {
        const spoofedUser = await findUserWithOrganizationUsers(db, spoofedBasic.id);
        if (spoofedUser) {
          await setUserContext(c, spoofedUser);
          c.set('spoofedBy', user);
          c.header('spoofing-user-email', user.email);
          c.header('spoofed-user-email', spoofEmail);
          return next();
        }
      }
    }

    await setUserContext(c, user);
  } catch {
    // Invalid session
  }

  await next();
}

/**
 * Require auth middleware - rejects requests without valid auth
 * Use this on protected routes
 */
export async function requireAuthMiddleware(c: Context<AppEnv>, next: Next) {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
  }

  await next();
}
