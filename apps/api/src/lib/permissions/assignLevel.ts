/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import {
  type Entitlements,
  type GrantResource,
  grantReaches,
  greaterRole,
  type Role,
  rebacSchema,
  roleHierarchy,
} from '@template/permissions';

const actionLevel = (resource: GrantResource, action: string): Role => {
  const reachedBy = roleHierarchy.find((role) =>
    grantReaches(resource, { role, entitlements: null }, action),
  );
  if (reachedBy) return reachedBy;
  return rebacSchema.permissions[resource]?.actions[action] === undefined ? 'member' : 'owner';
};

export const assignLevel = (
  role: Role | null,
  entitlements: Entitlements,
  resource: GrantResource = 'db:organization',
): Role =>
  greaterRole(
    role,
    ...Object.keys(entitlements ?? {})
      .filter((action) => entitlements?.[action] === true)
      .map((action) => actionLevel(resource, action)),
  );
