import type { Db } from '@template/db';
import type { OrganizationUser, SpaceUser, User } from '@template/db/generated/client/client';
import { cache, cacheKey, upsertCache } from '@template/db';

const USER_CACHE_TTL = 60 * 10 + 6; // 10.1 minutes
const RECORD_CACHE_TTL = 60 * 10; // 10 minutes

export type OrganizationUserWithSpaceUsers = OrganizationUser & { spaceUsers: SpaceUser[] };
export type UserWithOrganizationUsers = User & { organizationUsers: OrganizationUserWithSpaceUsers[] };

/**
 * Find user by email (cached)
 */
export async function findUserByEmail(
  db: Db,
  email: string,
): Promise<User | null> {
  return cache<User | null>(
    cacheKey('User', { email }),
    () => db.user.findFirst({ where: { email } }),
    USER_CACHE_TTL,
  );
}

/**
 * Find user by ID with organization memberships (cached)
 * Only includes orgs that aren't soft-deleted
 */
export async function findUserWithOrganizationUsers(
  db: Db,
  userId: string,
): Promise<UserWithOrganizationUsers | null> {
  return cache<UserWithOrganizationUsers | null>(
    cacheKey('User', userId, ['OrganizationUsers']),
    async () => {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          organizationUsers: {
            where: { organization: { deletedAt: null } },
            include: {
              spaceUsers: { where: { space: { deletedAt: null } } },
            },
          },
        },
      }) as UserWithOrganizationUsers | null;

      if (user) {
        upsertCache(cacheKey('user', user.id), user, { ttl: RECORD_CACHE_TTL });
        for (const orgUser of user.organizationUsers) {
          upsertCache(cacheKey('organizationUser', { organizationId: orgUser.organizationId, userId: orgUser.userId }), orgUser, { ttl: RECORD_CACHE_TTL });
          for (const spaceUser of orgUser.spaceUsers) {
            upsertCache(cacheKey('spaceUser', { organizationId: spaceUser.organizationId, spaceId: spaceUser.spaceId, userId: spaceUser.userId }), spaceUser, { ttl: RECORD_CACHE_TTL });
          }
        }
      }

      return user;
    },
    USER_CACHE_TTL,
  );
}
