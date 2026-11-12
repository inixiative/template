/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:authz
 */
import { createHash } from 'node:crypto';
import { LogScope, log } from '@template/shared/logger';
import type { Context, Next } from 'hono';
import { loadTokenContext } from '#/lib/context/loadTokenContext';
import { setTokenContext } from '#/lib/context/setTokenContext';
import type { AppEnv } from '#/types/appEnv';

const authenticateToken = async (c: Context<AppEnv>): Promise<void> => {
  const db = c.get('db');

  // Check header first, then URL query param (for WebSocket, email links, etc.)
  const authorization = c.req.header('authorization');
  const urlToken = new URL(c.req.url).searchParams.get('token');

  const apiKey = authorization?.startsWith('Bearer ') ? authorization.slice(7) : urlToken;

  if (!apiKey) return;
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  const signIn = await loadTokenContext(keyHash);
  if (!signIn) return;
  if (signIn.fetched)
    await db.token.update({
      where: { id: signIn.context.token.id },
      data: { lastUsedAt: new Date() },
    });
  await setTokenContext(c, signIn.context);
};

export const tokenAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (!c.get('user')) {
    try {
      await authenticateToken(c);
    } catch (err) {
      // Invalid token, lookup failure, or cache miss. Log so failure modes like
      // Redis-down or DB-down don't silently masquerade as "no token".
      log.warn('token auth lookup failed', { err }, LogScope.auth);
    }
  }

  await next();
};
