/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses infrastructure:redis, infrastructure:prisma, primitive:authz
 */
import { createHash } from 'node:crypto';
import { cache, cacheKey } from '@template/db';
import type { Token } from '@template/db/generated/client/client';
import { LogScope, log } from '@template/shared/logger';
import type { Context, Next } from 'hono';
import { loadTokenContext } from '#/lib/context/loadTokenContext';
import { setTokenContext } from '#/lib/context/setTokenContext';
import type { AppEnv } from '#/types/appEnv';

const TOKEN_CACHE_TTL = 60 * 10;

const authenticateToken = async (c: Context<AppEnv>): Promise<void> => {
  const db = c.get('db');

  // Check header first, then URL query param (for WebSocket, email links, etc.)
  const authorization = c.req.header('authorization');
  const urlToken = new URL(c.req.url).searchParams.get('token');

  const apiKey = authorization?.startsWith('Bearer ') ? authorization.slice(7) : urlToken;

  if (!apiKey) return;
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  const tokenRow = await cache<Token | null>(
    cacheKey('Token', { keyHash }),
    async () => {
      const found = await db.token.findUnique({
        where: {
          keyHash,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      // Touch lastUsedAt on cache-miss only (≈ TTL granularity): keeps it off the request
      // hot path and avoids a fire-and-forget write racing the later batch reads (P2028).
      if (found)
        await db.token.update({ where: { id: found.id }, data: { lastUsedAt: new Date() } });
      return found;
    },
    TOKEN_CACHE_TTL,
  );

  if (!tokenRow) return;

  const context = await loadTokenContext(tokenRow);
  if (context) await setTokenContext(c, context);
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
