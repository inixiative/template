/**
 * @atlas
 * @kind type, helper
 * @partOf primitive:requestContext, primitive:authz
 * @uses none
 */
import type { UserWithRelations } from '@template/db';
import type { EntitlementGrant, Entitlements, IntegrationBinding } from '@template/permissions';
import type { Context } from 'hono';
import type { TokenWithRelations } from '#/lib/context/types';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

type OrganizationUserOfToken = NonNullable<TokenWithRelations['organizationUser']>;
type SpaceUserOfToken = NonNullable<TokenWithRelations['spaceUser']>;

export type Principal = {
  user: UserWithRelations | null;
  token: TokenWithRelations | null;
  grant: (EntitlementGrant & IntegrationBinding) | null;
};

export type UnpackedPrincipal = Principal & {
  organization: OrganizationUserOfToken['organization'] | null;
  organizationUser: Omit<OrganizationUserOfToken, 'user' | 'organization'> | null;
  space: SpaceUserOfToken['space'] | null;
  spaceUser: Omit<SpaceUserOfToken, 'user' | 'organization' | 'organizationUser' | 'space'> | null;
};

const tokenGrant = (token: TokenWithRelations): Principal['grant'] => ({
  role: validateRole(token.role),
  entitlements: token.entitlements as Entitlements,
  entitlementsOnly: token.entitlementsOnly,
  integrationId: token.integrationId,
  integrationReach: token.integrationReach,
  integrationReachIds: token.integrationReachIds,
});

const unpackOrganizationUser = (
  token: TokenWithRelations | null,
): UnpackedPrincipal['organizationUser'] => {
  if (token?.organizationUser) {
    const {
      user: _user,
      organization: _organization,
      ...organizationUser
    } = token.organizationUser;
    return organizationUser;
  }
  return token?.spaceUser?.organizationUser ?? null;
};

const unpackSpaceUser = (token: TokenWithRelations | null): UnpackedPrincipal['spaceUser'] => {
  if (!token?.spaceUser) return null;
  const {
    user: _user,
    organization: _organization,
    organizationUser: _organizationUser,
    space: _space,
    ...spaceUser
  } = token.spaceUser;
  return spaceUser;
};

export const getPrincipal = (c: Context<AppEnv>): UnpackedPrincipal => {
  const user = c.get('user');
  const token = c.get('token');
  return {
    user: user && {
      ...user,
      organizationUsers: c.get('organizationUsers') ?? [],
      organizations: c.get('organizations') ?? [],
      spaceUsers: c.get('spaceUsers') ?? [],
      spaces: c.get('spaces') ?? [],
    },
    token,
    grant: token ? tokenGrant(token) : c.get('entitlementGrant'),
    organization:
      token?.organizationUser?.organization ??
      token?.spaceUser?.organization ??
      token?.organization ??
      null,
    organizationUser: unpackOrganizationUser(token),
    space: token?.spaceUser?.space ?? token?.space ?? null,
    spaceUser: unpackSpaceUser(token),
  };
};
