/**
 * @atlas
 * @kind service
 * @partOf feature:users
 * @uses infrastructure:prisma, primitive:caching
 */
import type { UserWithRelations } from '@template/db';
import { cache, cacheKey, db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { Role } from '@template/db/generated/client/enums';

const USER_CACHE_TTL = 60 * 10 + 6; // 10.1 minutes

export const findUserByEmail = async (email: string): Promise<User | null> => {
  return cache<User | null>(
    cacheKey('User', { email }),
    () => db.user.findFirst({ where: { email } }),
    USER_CACHE_TTL,
  );
};

export const findUserWithRelations = async (userId: string): Promise<UserWithRelations | null> => {
  return cache<UserWithRelations | null>(
    cacheKey('User', userId, ['relations']),
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
            OR: [{ spaceUsers: { some: { userId } } }, { organizationId: { in: ownedOrgIds } }],
          },
        }),
      ]);

      return { ...user, organizations, spaceUsers, spaces };
    },
    USER_CACHE_TTL,
  );
};
