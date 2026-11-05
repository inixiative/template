/**
 * @atlas
 * @kind service
 * @partOf feature:users
 * @uses infrastructure:prisma, primitive:caching
 */
import type { UserWithRelations } from '@template/db';
import { cache, cacheKey, db, fetchOne } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import { Role } from '@template/db/generated/client/enums';
import { compact, uniqBy } from 'lodash-es';

const USER_CACHE_TTL = 60 * 10 + 6; // 10.1 minutes

export const findUserByEmail = async (email: string): Promise<User | null> => {
  return cache<User | null>(
    cacheKey('User', { email }),
    () => db.user.findFirst({ where: { email } }),
    USER_CACHE_TTL,
  );
};

const organizationUsersOf = (userId: string): Promise<OrganizationUser[]> =>
  cache(
    cacheKey('user', userId, ['organizationUsers']),
    () => db.organizationUser.findMany({ where: { userId, organization: { deletedAt: null } } }),
    USER_CACHE_TTL,
  );

const spaceUsersOf = (userId: string): Promise<SpaceUser[]> =>
  cache(
    cacheKey('user', userId, ['spaceUsers']),
    () => db.spaceUser.findMany({ where: { userId, space: { deletedAt: null } } }),
    USER_CACHE_TTL,
  );

const spacesOfOrganization = (organizationId: string): Promise<Space[]> =>
  cache(
    cacheKey('organization', organizationId, ['spaces']),
    () => db.space.findMany({ where: { organizationId } }),
    USER_CACHE_TTL,
  );

export const findUserWithRelations = async (userId: string): Promise<UserWithRelations | null> => {
  const user = await fetchOne<User>('user', userId, USER_CACHE_TTL);
  if (!user) return null;

  const [organizationUsers, spaceUsers] = await Promise.all([
    organizationUsersOf(userId),
    spaceUsersOf(userId),
  ]);
  const ownedOrganizationIds = organizationUsers
    .filter((organizationUser) => organizationUser.role === Role.owner)
    .map((organizationUser) => organizationUser.organizationId);

  const [organizations, memberSpaces, ownedSpaces] = await Promise.all([
    Promise.all(
      organizationUsers.map((organizationUser) =>
        fetchOne<Organization>('organization', organizationUser.organizationId, USER_CACHE_TTL),
      ),
    ),
    Promise.all(
      spaceUsers.map((spaceUser) => fetchOne<Space>('space', spaceUser.spaceId, USER_CACHE_TTL)),
    ),
    Promise.all(ownedOrganizationIds.map(spacesOfOrganization)),
  ]);

  return {
    ...user,
    organizationUsers,
    organizations: compact(organizations),
    spaceUsers,
    spaces: uniqBy(compact([...memberSpaces, ...ownedSpaces.flat()]), 'id'),
  };
};
