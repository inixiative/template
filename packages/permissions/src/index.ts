export { Role } from '@template/db/generated/client/enums';
export { actorOf } from './actorOf';
// Client
export {
  type Action,
  type Actor,
  ActorModel,
  createPermissions,
  type EntitlementEntry,
  OrganizationAction,
  type PermissionEntry,
  type Permix,
  TokenAction,
  UserAction,
} from './client';
// ReBAC
export { check as rebacCheck } from './rebac/check';
export { rebacSchema } from './rebac/schema';
export type { ActionRule } from './rebac/types';
export { capAtRole } from './roles/capAtRole';
export type { DelegatePermissions } from './roles/delegatePermissions';
// Organization permissions
export { getOrgPermissions } from './roles/organization';
// Shared role utilities
export { isSuperadmin } from './roles/shared';
export { getSpacePermissions } from './roles/space';
export {
  type Grant,
  grantsPermix,
  installGrants,
  organizationOwnerGrants,
  spaceOwnerGrants,
  userGrants,
} from './roles/userGrants';
export { wellFormedEntitlements } from './roles/wellFormedEntitlements';
export type { PermissionsCheck } from './types';
