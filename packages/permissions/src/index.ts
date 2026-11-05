export { Role } from '@template/db/generated/client/enums';
export { actorOf } from './actorOf';
// Client
export {
  type Action,
  type Actor,
  ActorModel,
  createPermissions,
  delegate,
  type EntitlementEntry,
  installPermissions,
  OrganizationAction,
  type PermissionEntry,
  type Permissions,
  type Permix,
  TokenAction,
  UserAction,
  wellFormedEntitlements,
} from './client';
// ReBAC
export { check as rebacCheck } from './rebac/check';
export { rebacSchema } from './rebac/schema';
export type { ActionRule } from './rebac/types';
export type { DelegatePermissions } from './roles/delegatePermissions';
export { isMemberSelfGrant, type MemberResource, memberSelfGrant } from './roles/memberSelfGrant';
// Organization permissions
export { getOrgPermissions } from './roles/organization';
export {
  organizationOwnerPermissions,
  permissionsOfUser,
  spaceOwnerPermissions,
} from './roles/permissionsOfUser';
// Shared role utilities
export { isSuperadmin, roleToStandardAction } from './roles/shared';
export { getSpacePermissions } from './roles/space';
export type { PermissionsCheck } from './types';
