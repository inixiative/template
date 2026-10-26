/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses infrastructure:prisma, feature:users
 */
import { fetchOne, type UserWithRelations } from '@template/db';
import type {
  Integration,
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  Token,
  User,
} from '@template/db/generated/client/client';
import type { TokenWithRelations } from '#/lib/context/types';
import { findUserWithRelations } from '#/modules/user/services/find';

export type TokenContext = { token: TokenWithRelations; user: UserWithRelations | null };

const ownerExists = (token: TokenWithRelations): boolean => {
  switch (token.ownerModel) {
    case 'User':
      return Boolean(token.user);
    case 'Organization':
      return Boolean(token.organization);
    case 'Space':
      return Boolean(token.space);
    case 'OrganizationUser':
      return Boolean(token.organizationUser);
    case 'SpaceUser':
      return Boolean(token.spaceUser);
    case 'Integration':
      return Boolean(token.integration);
  }
};

// why: owners load under their own keys, which the cache hook clears; the token's key does not.
const loadOwners = async (token: Token): Promise<TokenWithRelations> => {
  const { organizationId, spaceId, userId, integrationId } = token;
  const [user, organization, space, organizationUser, spaceUser, integration] = await Promise.all([
    userId ? fetchOne<User>('user', userId) : null,
    organizationId ? fetchOne<Organization>('organization', organizationId) : null,
    spaceId ? fetchOne<Space>('space', spaceId) : null,
    organizationId && userId
      ? fetchOne<OrganizationUser>('organizationUser', { organizationId, userId })
      : null,
    organizationId && spaceId && userId
      ? fetchOne<SpaceUser>('spaceUser', { organizationId, spaceId, userId })
      : null,
    integrationId ? fetchOne<Integration>('integration', integrationId) : null,
  ]);
  const hasMember = organizationUser && user && organization;
  return {
    ...token,
    user,
    organization,
    space,
    integration,
    organizationUser: hasMember ? { ...organizationUser, user, organization } : null,
    spaceUser:
      spaceUser && hasMember && space
        ? { ...spaceUser, user, organization, organizationUser, space }
        : null,
  };
};

const userOf = async (token: TokenWithRelations): Promise<UserWithRelations | null> =>
  token.ownerModel === 'User' && token.user ? findUserWithRelations(token.user.id) : null;

export const loadTokenContext = async (row: Token): Promise<TokenContext | null> => {
  if (!row.isActive) return null;
  if (row.expiresAt && row.expiresAt <= new Date()) return null;

  const token = await loadOwners(row);
  if (!ownerExists(token)) return null;

  const user = await userOf(token);
  if (token.ownerModel === 'User' && !user) return null;
  return { token, user };
};
