export { Role } from '@template/db/generated/client/enums';
// Actor
export { ActorModel, buildActor, inPerson, type TemplateActor } from './actor';
// Client
export {
  type Action,
  type ActionState,
  type CustomAction,
  createPermissions,
  type Entitlements,
  InquiryAction,
  MembershipAction,
  OrganizationAction,
  type PermissionEntry,
  type Permix,
  SessionAction,
  SpaceAction,
  StandardAction,
  UserAction,
} from './client';
// Holders
export {
  BindError,
  type BindRoots,
  createInterpolator,
  entitlementEntries,
  type GrantResource,
  isFlatEntitlements,
  normalizeEntitlements,
  parseGrantKey,
  resolveSelfKeys,
  roleReaches,
  SELF,
  type SelfIds,
  type SelfModel,
} from './holder';
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
// Membership permissions
export {
  getMembershipPermissions,
  type MembershipResource,
  membershipRoles,
} from './roles/membership';
// Organization permissions
export { getOrgPermissions, organizationRoles } from './roles/organization';
// Shared role utilities
export {
  allTrue,
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
