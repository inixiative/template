import type { Context, Next } from 'hono';

/**
 * Basic HTTP authentication middleware.
 * Used to protect admin routes like BullBoard.
 *
 * Note: For production, consider placing behind VPN/firewall.
 */
export function basicAuthMiddleware(username: string, password: string, realm = 'Secure Area') {
  const unauthorized = () =>
    new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': `Basic realm="${realm}"` },
    });

  return async (c: Context, next: Next) => {
    const authorization = c.req.header('Authorization');
    if (!authorization) return unauthorized();

    const [scheme, credentials] = authorization.split(' ');
    if (scheme !== 'Basic' || !credentials) return unauthorized();

    try {
      const decoded = atob(credentials);
      const colonIdx = decoded.indexOf(':');
      if (colonIdx === -1) return unauthorized();

      const user = decoded.slice(0, colonIdx);
      const pass = decoded.slice(colonIdx + 1); // Handles passwords with colons

      if (user !== username || pass !== password) {
        return unauthorized();
      }
    } catch {
      return unauthorized();
    }

    await next();
  };
}
