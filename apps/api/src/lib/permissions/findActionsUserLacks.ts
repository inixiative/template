/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { UserWithRelations } from '@template/db';
import {
  type Entitlements,
  grantReaches,
  isSuperadmin,
  userLoginGrant,
} from '@template/permissions';
import { membershipGrant } from '#/lib/permissions/membershipGrant';

export const findActionsUserLacks = (
  user: UserWithRelations,
  entitlements: Entitlements | undefined,
): string[] => {
  if (isSuperadmin(user)) return [];
  return Object.keys(entitlements ?? {}).filter(
    (action) =>
      entitlements?.[action] === true &&
      !grantReaches('db:user', userLoginGrant, action) &&
      !user.organizationUsers.some((organizationUser) =>
        grantReaches('db:organization', membershipGrant(organizationUser), action),
      ) &&
      !user.spaceUsers.some((spaceUser) =>
        grantReaches('db:space', membershipGrant(spaceUser), action),
      ),
  );
};
