/**
 * @atlas
 * @kind type, helper
 * @partOf primitive:authz, primitive:requestContext
 * @uses none
 */
import type { UserWithRelations } from '@template/db';
import type { Context } from 'hono';
import type { GrantedEntitlements, TokenWithRelations } from '#/lib/context/types';
import type { AppEnv } from '#/types/appEnv';

export type PrincipalContext = {
  user: UserWithRelations | null;
  token: TokenWithRelations | null;
  jwtGrant: GrantedEntitlements | null;
};

export const principalFromContext = (c: Context<AppEnv>): PrincipalContext => {
  const user = c.get('user');
  return {
    user: user && {
      ...user,
      organizationUsers: c.get('organizationUsers') ?? [],
      organizations: c.get('organizations') ?? [],
      spaceUsers: c.get('spaceUsers') ?? [],
      spaces: c.get('spaces') ?? [],
    },
    token: c.get('token') ?? null,
    jwtGrant: c.get('entitlementGrant') ?? null,
  };
};
