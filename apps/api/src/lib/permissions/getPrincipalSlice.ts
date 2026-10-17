/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz, primitive:requestContext
 * @uses none
 */
import type { Entitlements, Slice } from '@template/permissions';
import type { Context } from 'hono';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

export const getPrincipalSlice = (c: Context<AppEnv>): Slice | null => {
  const token = c.get('token');
  if (!token) return c.get('slice');
  return {
    role: validateRole(token.role),
    entitlements: token.entitlements as Entitlements,
    entitlementsOnly: token.entitlementsOnly,
  };
};
