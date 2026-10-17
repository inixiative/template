/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { UserId } from '@template/db';
import { capSlice, getUserPermissions, UserAction, userLoginGrant } from '@template/permissions';
import type { Context } from 'hono';
import { getPrincipalSlice } from '#/lib/permissions/getPrincipalSlice';
import type { AppEnv } from '#/types/appEnv';

const membershipTokenModels = ['OrganizationUser', 'SpaceUser'];

export const setupUserPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const user = c.get('user');
  if (!user) return;

  const token = c.get('token');
  if (token && membershipTokenModels.includes(token.ownerModel)) {
    await permix.setup(
      getUserPermissions(user.id as UserId, 'viewer', { [UserAction.identify]: true }, true),
    );
    return;
  }

  const slice = getPrincipalSlice(c);
  const grant = slice
    ? capSlice('db:user', userLoginGrant, slice)
    : { ...userLoginGrant, entitlementsOnly: false };

  await permix.setup(
    getUserPermissions(
      user.id as UserId,
      grant.role,
      { ...grant.entitlements, [UserAction.identify]: true },
      grant.entitlementsOnly,
    ),
  );
};
