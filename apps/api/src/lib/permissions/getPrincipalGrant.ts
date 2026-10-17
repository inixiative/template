/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz, primitive:requestContext
 * @uses none
 */
import type { EntitlementGrant, Entitlements } from '@template/permissions';
import type { Context } from 'hono';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

export const getPrincipalGrant = (c: Context<AppEnv>): EntitlementGrant | null => {
  const token = c.get('token');
  if (!token) return c.get('entitlementGrant');
  return {
    role: validateRole(token.role),
    entitlements: token.entitlements as Entitlements,
    entitlementsOnly: token.entitlementsOnly,
  };
};
