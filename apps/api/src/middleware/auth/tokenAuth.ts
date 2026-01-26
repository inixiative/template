import { createHash } from 'crypto';
import type { Context, Next } from 'hono';
import { cache } from '#/lib/cache/cache';
import type { TokenWithRelations } from '#/lib/context/getToken';
import { getUser } from '#/lib/context/getUser';
import { setUserContext } from '#/lib/context/setUserContext';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { findUserWithOrganizationUsers } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export const tokenAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const db = c.get('db');

  if (getUser(c)) return next();

  try {
    const authorization = c.req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) return next();

    const apiKey = authorization.slice(7);
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const token = await cache<TokenWithRelations | null>(`tokens:keyHash:${keyHash}`, () =>
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

    // User or OrgUser token → load user with org memberships
    if ((token.ownerModel === 'User' || token.ownerModel === 'OrganizationUser') && token.user) {
      const userWithOrgs = await findUserWithOrganizationUsers(db, token.user.id);
      if (userWithOrgs) await setUserContext(c, userWithOrgs);
    } else {
      // Org token → just set up permissions (no user context)
      await setupOrgPermissions(c);
    }
  } catch {
    // Invalid token
  }

  await next();
};
