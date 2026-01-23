import type { AppEnv } from '@src/types/appEnv';
import { verifyJwt } from '@src/modules/auth/services/jwt';
import type { Context, Next } from 'hono';

/**
 * Auth middleware - extracts and verifies JWT from Authorization header
 * Sets user in context if valid, null otherwise
 * Does NOT reject requests - routes decide if auth is required
 */
export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyJwt(token);

    if (payload) {
      c.set('user', {
        id: payload.sub,
        email: payload.email,
      });
    }
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
