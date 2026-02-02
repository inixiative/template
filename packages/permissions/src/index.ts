/**
 * PACKAGE INDEX FILE - Cross-package exports use relative imports.
 * All other files in this package should use absolute #/ imports.
 */

// Client
export {
  createPermissions,
  StandardAction,
  OrganizationAction,
  SpaceAction,
  UserAction,
  type Permix,
  type PermissionEntry,
  type ActionState,
  type Action,
  type Entitlements,
} from './client';

// ReBAC
export { check as rebacCheck } from './rebac/check';
export { rebacSchema } from './rebac/schema';
export type { ActionRule, ModelPermission, RebacSchema, RelationCheck, RuleCheck } from './rebac/types';

// Shared role utilities
export {
  isSuperadmin,
  roleHierarchy,
  lesserRole,
  greaterRole,
  intersectEntitlements,
  allTrue,
  roleToStandardAction,
} from './roles/shared';

// Organization permissions
export {
  organizationRoles,
  getOrgPermissions,
  setupOrgContext,
} from './roles/organization';

// User permissions
export {
  userRoles,
  getUserPermissions,
  setupUserContext,
} from './roles/user';

// Space permissions
export {
  spaceRoles,
  getSpacePermissions,
  setupSpaceContext,
} from './roles/space';

export { Role, SpaceRole } from '@template/db/generated/client/enums';
