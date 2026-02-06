import { createHash } from 'crypto';
import type { Context, Next } from 'hono';
import { cache, cacheKey, upsertCache } from '@template/db';
import type { TokenWithRelations } from '#/lib/context/types';

import { setUserContext } from '#/lib/context/setUserContext';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { findUserWithRelations } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export const tokenAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const db = c.get('db');

  if (c.get('user')) return next();

  try {
    // Check header first, then URL query param (for WebSocket, email links, etc.)
    const authorization = c.req.header('authorization');
    const urlToken = new URL(c.req.url).searchParams.get('token');

    const apiKey = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : urlToken;

    if (!apiKey) return next();
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const token = await cache<TokenWithRelations | null>(
      cacheKey('Token', { keyHash }),
      () =>
        db.token.findUnique({
          where: {
            keyHash,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: {
            user: true,
            organization: true,
            organizationUser: {
              include: {
                user: true,
                organization: true,
              },
            },
            space: true,
            spaceUser: {
              include: {
                user: true,
                organization: true,
                organizationUser: true,
                space: true,
              },
            },
          },
        }),
      60 * 10, // 10-minute TTL to balance performance with security (revoked tokens re-checked)
    );

    if (!token) return next();

    if (token.user) upsertCache(cacheKey('user', token.user.id), token.user);
    if (token.organization) upsertCache(cacheKey('organization', token.organization.id), token.organization);
    if (token.organizationUser) upsertCache(cacheKey('organizationUser', { organizationId: token.organizationUser.organizationId, userId: token.organizationUser.userId }), token.organizationUser);
    if (token.space) upsertCache(cacheKey('space', token.space.id), token.space);
    if (token.spaceUser) upsertCache(cacheKey('spaceUser', { organizationId: token.spaceUser.organizationId, spaceId: token.spaceUser.spaceId, userId: token.spaceUser.userId }), token.spaceUser);

    // Update lastUsedAt (fire and forget, don't block request)
    db.token
      .update({
        where: { id: token.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    c.set('token', token);

    if (token.ownerModel === 'User' && token.user) {
      // User token → load user with all org memberships
      const userWithOrgs = await findUserWithRelations(db, token.user.id);
      if (userWithOrgs) await setUserContext(c, userWithOrgs);
    } else if (token.ownerModel === 'OrganizationUser' && token.organizationUser) {
      // OrgUser token → use token data directly (scoped to single org)
      const { user: orgUserUser, organization, ...orgUserFields } = token.organizationUser;
      await setUserContext(c, {
        ...orgUserUser,
        organizationUsers: [orgUserFields],
        organizations: organization ? [organization] : [],
        spaceUsers: [],
        spaces: [],
      });
    } else if (token.ownerModel === 'SpaceUser' && token.spaceUser) {
      // SpaceUser token → use token data directly (scoped to single space)
      const { user: spaceUserUser, organization, organizationUser, space, ...spaceUserFields } = token.spaceUser;
      await setUserContext(c, {
        ...spaceUserUser,
        organizationUsers: organizationUser ? [organizationUser] : [],
        organizations: organization ? [organization] : [],
        spaceUsers: [spaceUserFields],
        spaces: space ? [space] : [],
      });
    } else {
      // Org/Space token → just set up permissions (no user context)
      await setupOrgPermissions(c);
    }
  } catch {
    // Invalid token
  }

  await next();
};
