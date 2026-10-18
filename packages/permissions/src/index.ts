export { Role } from '@template/db/generated/client/enums';
// Client
export {
  type Action,
  type ActionState,
  type CustomAction,
  createPermissions,
  type Entitlements,
  InquiryAction,
  OrganizationAction,
  type PermissionEntry,
  type Permix,
  SessionAction,
  SpaceAction,
  StandardAction,
  UserAction,
} from './client';
// Grants
export {
  capGrant,
  type EntitlementGrant,
  type Grant,
  type GrantResource,
  grantReaches,
  userLoginGrant,
} from './grant';
// ReBAC
export { check as rebacCheck } from './rebac/check';
export { rebacSchema } from './rebac/schema';
export type {
  ActionRule,
  RebacSchema,
  RelationCheck,
  ResourcePermission,
  RuleCheck,
} from './rebac/types';
// Organization permissions
export { getOrgPermissions, organizationRoles } from './roles/organization';
// Shared role utilities
export {
  allTrue,
  grantActions,
  greaterRole,
  isSuperadmin,
  lesserRole,
  roleHierarchy,
  rolesAtOrAbove,
  roleToStandardAction,
} from './roles/shared';
// Space permissions
export { getSpacePermissions, spaceRoles } from './roles/space';
// User permissions
export { getUserPermissions, userRoles } from './roles/user';
export type { PermissionsCheck } from './types';
