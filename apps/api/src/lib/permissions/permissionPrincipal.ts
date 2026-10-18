/**
 * @atlas
 * @kind type, helper
 * @partOf primitive:authz, primitive:requestContext
 * @uses none
 */
import type { UserWithRelations } from '@template/db';
import type { EntitlementGrant, Entitlements } from '@template/permissions';
import type { Context } from 'hono';
import type { TokenWithRelations } from '#/lib/context/types';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

export type PermissionPrincipal = {
  user: UserWithRelations | null;
  token: TokenWithRelations | null;
  grant: EntitlementGrant | null;
};

export const principalFromContext = (c: Context<AppEnv>): PermissionPrincipal => {
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
    grant: token
      ? {
          role: validateRole(token.role),
          entitlements: token.entitlements as Entitlements,
          entitlementsOnly: token.entitlementsOnly,
        }
      : c.get('entitlementGrant'),
  };
};
