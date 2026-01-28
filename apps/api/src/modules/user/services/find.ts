import type { ExtendedPrismaClient, OrganizationUser, User } from '@template/db';
import { cache, cacheKey } from '#/lib/cache';

const USER_CACHE_TTL = 60 * 10; // 10 minutes

export type UserWithOrganizationUsers = User & { organizationUsers: OrganizationUser[] };

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
 * Find user by ID with organization memberships (cached)
 * Only includes orgs that aren't soft-deleted
 */
export async function findUserWithOrganizationUsers(
  db: ExtendedPrismaClient,
  userId: string,
): Promise<UserWithOrganizationUsers | null> {
  return cache<UserWithOrganizationUsers | null>(
    cacheKey('User', userId, 'id', ['OrganizationUsers']),
    async () =>
      db.user.findUnique({
        where: { id: userId },
        include: {
          organizationUsers: {
            where: { organization: { deletedAt: null } },
          },
        },
      }) as Promise<UserWithOrganizationUsers | null>,
    USER_CACHE_TTL,
  );
}
