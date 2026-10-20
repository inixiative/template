/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import type { OrganizationId, SpaceId, UserId, UserWithRelations } from '@template/db';
import {
  type EntitlementGrant,
  type GrantEntry,
  getMembershipPermissions,
  getOrgPermissions,
  getSpacePermissions,
  getUserPermissions,
  type PermissionEntry,
  type Permix,
  projectGrant,
  UserAction,
} from '@template/permissions';
import { type GrantedCredential, grantEntries } from '#/lib/permissions/grantEntries';

const membershipCredentials = ['OrganizationUser', 'SpaceUser'];

const entryPermissions = (
  { resource, record }: GrantEntry,
  { role, entitlements, entitlementsOnly }: EntitlementGrant,
): PermissionEntry => {
  if (resource === 'db:user')
    return getUserPermissions(
      record.id as UserId,
      role,
      { ...entitlements, [UserAction.identify]: true },
      entitlementsOnly,
    );
  if (resource === 'db:organization')
    return getOrgPermissions(role, record.id as OrganizationId, entitlements, entitlementsOnly);
  if (resource === 'db:space')
    return getSpacePermissions(role, record.id as SpaceId, entitlements, entitlementsOnly);
  return getMembershipPermissions(resource, role, record.id, entitlements, entitlementsOnly);
};

export const setupGrantPermissions = async (
  permix: Permix,
  holder: Permix,
  user: UserWithRelations,
  credential: GrantedCredential | null,
  grant: EntitlementGrant,
) => {
  const identifyOnly =
    credential && membershipCredentials.includes(credential.ownerModel)
      ? [getUserPermissions(user.id as UserId, 'viewer', { [UserAction.identify]: true }, true)]
      : [];
  await permix.setup([
    ...identifyOnly,
    ...grantEntries(user, credential).map((entry) =>
      entryPermissions(entry, projectGrant(holder, entry, grant)),
    ),
  ]);
};
