/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses infrastructure:redis, infrastructure:prisma, primitive:authz
 */
import { createHash } from 'node:crypto';
import { cache, cacheKey, hydrate } from '@template/db';
import type { Token } from '@template/db/generated/client/client';
import { LogScope, log } from '@template/shared/logger';
import type { Context, Next } from 'hono';
import { setUserContext } from '#/lib/context/setUserContext';
import type { TokenWithRelations } from '#/lib/context/types';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { setupSpacePermissions } from '#/lib/permissions/setupSpacePermissions';
import { findUserWithRelations } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

const TOKEN_CACHE_TTL = 60 * 10;

const ownerExists = (token: TokenWithRelations): boolean => {
  switch (token.ownerModel) {
    case 'User':
      return Boolean(token.user);
    case 'Organization':
      return Boolean(token.organization);
    case 'Space':
      return Boolean(token.space);
    case 'OrganizationUser':
      return Boolean(token.organizationUser?.user && token.organizationUser.organization);
    case 'SpaceUser':
      return Boolean(
        token.spaceUser?.user &&
          token.spaceUser.organization &&
          token.spaceUser.organizationUser &&
          token.spaceUser.space,
      );
  }
};

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
  if (tokenRow.expiresAt && tokenRow.expiresAt <= new Date()) return;

  // why: owners load under their own keys, which the cache hook clears; the token's key does not.
  const token = (await hydrate('token', tokenRow)) as TokenWithRelations;
  if (!ownerExists(token)) return;

  if (token.ownerModel === 'User' && token.user) {
    const userWithOrgs = await findUserWithRelations(token.user.id);
    if (!userWithOrgs) return;
    c.set('token', token);
    await setUserContext(c, userWithOrgs);
    return;
  }

  c.set('token', token);

  if (token.ownerModel === 'OrganizationUser' && token.organizationUser) {
    const { user: orgUserUser, organization, ...orgUserFields } = token.organizationUser;
    await setUserContext(c, {
      ...orgUserUser,
      organizationUsers: [orgUserFields],
      organizations: [organization],
      spaceUsers: [],
      spaces: [],
    });
  } else if (token.ownerModel === 'SpaceUser' && token.spaceUser) {
    const {
      user: spaceUserUser,
      organization,
      organizationUser,
      space,
      ...spaceUserFields
    } = token.spaceUser;
    await setUserContext(c, {
      ...spaceUserUser,
      organizationUsers: [organizationUser],
      organizations: [organization],
      spaceUsers: [spaceUserFields],
      spaces: [space],
    });
  } else {
    await setupOrgPermissions(c);
    await setupSpacePermissions(c);
  }
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
