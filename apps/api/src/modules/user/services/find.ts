import type { Db } from '@template/db';
import type { OrganizationUser, SpaceUser, User, Organization, Space } from '@template/db/generated/client/client';
import { Role } from '@template/db/generated/client/enums';
import { cache, cacheKey, upsertCache } from '@template/db';

const USER_CACHE_TTL = 60 * 10 + 6; // 10.1 minutes
const RECORD_CACHE_TTL = 60 * 10; // 10 minutes

export type UserWithRelations = User & {
  organizationUsers: OrganizationUser[];
  organizations: Organization[];
  spaceUsers: SpaceUser[];
  spaces: Space[];
};

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
 * Find user with all relations (cached)
 * Includes: flat organizationUsers, organizations, spaceUsers, and spaces arrays
 * Only includes orgs/spaces that aren't soft-deleted
 * Spaces include both explicit memberships and all spaces from owned orgs
 */
export async function findUserWithRelations(
  db: Db,
  userId: string,
): Promise<UserWithRelations | null> {
  return cache<UserWithRelations | null>(
    cacheKey('User', userId, ['Relations']),
    async () => {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          organizationUsers: {
            where: { organization: { deletedAt: null } },
          },
        },
      });

      if (!user) return null;

      const ownedOrgIds = user.organizationUsers
        .filter((ou) => ou.role === Role.owner)
        .map((ou) => ou.organizationId);

      const [organizations, spaceUsers, spaces] = await Promise.all([
        db.organization.findMany({
          where: {
            organizationUsers: { some: { userId } },
            deletedAt: null,
          },
        }),
        db.spaceUser.findMany({
          where: {
            userId,
            space: { deletedAt: null },
          },
        }),
        db.space.findMany({
          where: {
            deletedAt: null,
            OR: [
              { spaceUsers: { some: { userId } } },
              { organizationId: { in: ownedOrgIds } },
            ],
          },
        }),
      ]);

      const result: UserWithRelations = {
        ...user,
        organizations,
        spaceUsers,
        spaces,
      };

      // Cache all records
      upsertCache(cacheKey('user', user.id), user, { ttl: RECORD_CACHE_TTL });

      for (const org of organizations) {
        upsertCache(cacheKey('organization', org.id), org, { ttl: RECORD_CACHE_TTL });
      }

      for (const space of spaces) {
        upsertCache(cacheKey('space', space.id), space, { ttl: RECORD_CACHE_TTL });
      }

      for (const orgUser of user.organizationUsers) {
        upsertCache(cacheKey('organizationUser', { organizationId: orgUser.organizationId, userId: orgUser.userId }), orgUser, { ttl: RECORD_CACHE_TTL });
      }

      for (const spaceUser of spaceUsers) {
        upsertCache(cacheKey('spaceUser', { organizationId: spaceUser.organizationId, spaceId: spaceUser.spaceId, userId: spaceUser.userId }), spaceUser, { ttl: RECORD_CACHE_TTL });
      }

      return result;
    },
    USER_CACHE_TTL,
  );
}
