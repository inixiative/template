import type { ExtendedPrismaClient, OrganizationUser, Space, SpaceUser, User } from '@template/db';
import { cache, cacheKey } from '#/lib/cache/cache';

const USER_CACHE_TTL = 60 * 10; // 10 minutes

// SpaceUser with organizationId for permission context
export type SpaceUserWithOrg = SpaceUser & {
  space: Pick<Space, 'organizationId'>;
};

export type UserWithMemberships = User & {
  organizationUsers: OrganizationUser[];
  spaceUsers: SpaceUserWithOrg[];
};

/** @deprecated Use UserWithMemberships instead */
export type UserWithOrganizationUsers = UserWithMemberships;

/**
 * Find user by email (cached)
 */
export async function findUserByEmail(
  db: ExtendedPrismaClient,
  email: string,
): Promise<User | null> {
  return cache<User | null>(
    cacheKey('User', email, 'email'),
    () => db.user.findFirst({ where: { email } }),
    USER_CACHE_TTL,
  );
}

/**
 * Find user by ID with organization and space memberships (cached)
 * Only includes orgs/spaces that aren't soft-deleted
 */
export async function findUserWithOrganizationUsers(
  db: ExtendedPrismaClient,
  userId: string,
): Promise<UserWithMemberships | null> {
  return cache<UserWithMemberships | null>(
    cacheKey('User', userId, 'id', ['OrganizationUsers', 'SpaceUsers']),
    async () =>
      db.user.findUnique({
        where: { id: userId },
        include: {
          organizationUsers: {
            where: { organization: { deletedAt: null } },
          },
          spaceUsers: {
            where: { space: { deletedAt: null } },
            include: { space: { select: { organizationId: true } } },
          },
        },
      }) as Promise<UserWithMemberships | null>,
    USER_CACHE_TTL,
  );
}
