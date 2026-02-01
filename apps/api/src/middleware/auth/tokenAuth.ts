import { createHash } from 'crypto';
import type { Context, Next } from 'hono';
import { cache, cacheKey } from '#/lib/cache/cache';
import type { TokenWithRelations } from '#/lib/context/getToken';
import { getUser } from '#/lib/context/getUser';
import { setUserContext } from '#/lib/context/setUserContext';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { setupSpacePermissions } from '#/lib/permissions/setupSpacePermissions';
import { findUserWithOrganizationUsers } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export const tokenAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const db = c.get('db');

  if (getUser(c)) return next();

  try {
    // Check header first, then URL query param (for WebSocket, email links, etc.)
    const authorization = c.req.header('authorization');
    const urlToken = new URL(c.req.url).searchParams.get('token');

    const apiKey = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : urlToken;

    if (!apiKey) return next();
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const token = await cache<TokenWithRelations | null>(cacheKey('Token', keyHash, 'keyHash'), () =>
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
          space: {
            include: {
              organization: true,
            },
          },
          spaceUser: {
            include: {
              user: true,
              space: {
                include: {
                  organization: true,
                },
              },
            },
          },
        },
      }),
    );

    if (!token) return next();

    // Update lastUsedAt (fire and forget, don't block request)
    db.token
      .update({
        where: { id: token.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    c.set('token', token);

    if (token.ownerModel === 'User' && token.user) {
      // User token → load user with all org/space memberships
      const userWithMemberships = await findUserWithOrganizationUsers(db, token.user.id);
      if (userWithMemberships) await setUserContext(c, userWithMemberships);
    } else if (token.ownerModel === 'OrganizationUser' && token.organizationUser) {
      // OrgUser token → scoped to single org + user's spaces in that org
      const { user: orgUserUser, organization: _, ...orgUserFields } = token.organizationUser;

      // Load user's space memberships for spaces in this org
      const spaceUsersInOrg = await db.spaceUser.findMany({
        where: {
          userId: orgUserUser.id,
          space: {
            organizationId: token.organizationId!,
            deletedAt: null,
          },
        },
        include: { space: { select: { organizationId: true } } },
      });

      await setUserContext(c, {
        ...orgUserUser,
        organizationUsers: [orgUserFields],
        spaceUsers: spaceUsersInOrg,
      });
    } else if (token.ownerModel === 'SpaceUser' && token.spaceUser) {
      // SpaceUser token → use token data directly (scoped to single space)
      const { user: spaceUserUser, space: _, ...spaceUserFields } = token.spaceUser;
      await setUserContext(c, {
        ...spaceUserUser,
        organizationUsers: [],
        spaceUsers: [spaceUserFields],
      });
    } else if (token.ownerModel === 'Organization') {
      // Org token → just set up org permissions (no user context)
      await setupOrgPermissions(c);
    } else if (token.ownerModel === 'Space') {
      // Space token → just set up space permissions (no user context)
      await setupSpacePermissions(c);
    }
  } catch {
    // Invalid token
  }

  await next();
};
