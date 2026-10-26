export { Role } from '@template/db/generated/client/enums';
export { actorOf } from './actorOf';
// Client
export {
  type Action,
  type ActionState,
  type Actor,
  ActorModel,
  createPermissions,
  type EntitlementEntry,
  type Entitlements,
  InquiryAction,
  OrganizationAction,
  type PermissionEntry,
  type Permix,
  SpaceAction,
  StandardAction,
  TokenAction,
  UserAction,
} from './client';
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
export { type DelegatePermissions, delegateEntries } from './roles/delegatePermissions';
export { narrowing } from './roles/narrowing';
// Organization permissions
export { getOrgPermissions, organizationRoles } from './roles/organization';
// Shared role utilities
export {
  allTrue,
  greaterRole,
  isSuperadmin,
  roleHierarchy,
  rolesAtOrAbove,
  roleToStandardAction,
} from './roles/shared';
export { getSpacePermissions, spaceRoles } from './roles/space';
// User permissions
export { getUserPermissions, userRoles } from './roles/user';
export { userEntries } from './roles/userEntries';
export type { PermissionsCheck } from './types';
