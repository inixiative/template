/**
 * PACKAGE INDEX FILE - Cross-package exports use relative imports.
 * All other files in this package should use absolute #/ imports.
 */

export { Role } from '@template/db/generated/client/enums';
// Client
export {
  type Action,
  type ActionState,
  createPermissions,
  type Entitlements,
  OrganizationAction,
  type PermissionEntry,
  type Permix,
  SpaceAction,
  StandardAction,
  UserAction,
} from './client';
// ReBAC
export { check as rebacCheck } from './rebac/check';
export { rebacSchema } from './rebac/schema';
export type { ActionRule, ModelPermission, RebacSchema, RelationCheck, RuleCheck } from './rebac/types';

// Organization permissions
export { getOrgPermissions, organizationRoles } from './roles/organization';
// Shared role utilities
export {
  allTrue,
  greaterRole,
  intersectEntitlements,
  isSuperadmin,
  lesserRole,
  roleHierarchy,
  roleToStandardAction,
} from './roles/shared';

// Space permissions
export { getSpacePermissions, spaceRoles } from './roles/space';
// User permissions
export { getUserPermissions, userRoles } from './roles/user';
