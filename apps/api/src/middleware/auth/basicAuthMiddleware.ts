/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses primitive:errors
 */
import type { Context, Next } from 'hono';
import { makeError } from '#/lib/errors';

export const basicAuthMiddleware = (username: string, password: string, realm = 'Secure Area') => {
  const credentialsMatch = (authorization: string | undefined) => {
    const [scheme, credentials] = authorization?.split(' ') ?? [];
    if (scheme !== 'Basic' || !credentials) return false;
    let decoded: string;
    try {
      decoded = atob(credentials);
    } catch {
      return false;
    }
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) return false;
    return decoded.slice(0, colonIdx) === username && decoded.slice(colonIdx + 1) === password;
  };

  return async (c: Context, next: Next) => {
    if (!credentialsMatch(c.req.header('Authorization')))
      throw makeError({ status: 401, headers: { 'WWW-Authenticate': `Basic realm="${realm}"` } });
    await next();
  };
};
