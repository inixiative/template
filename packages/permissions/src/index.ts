export { Role } from '@template/db/generated/client/enums';
export { actorOf } from './actorOf';
// Client
export {
  type Action,
  type Actor,
  ActorModel,
  createPermissions,
  type EntitlementEntry,
  type Entitlements,
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
export { type DelegatePermissions, delegateEntries } from './roles/delegatePermissions';
export { narrowing } from './roles/narrowing';
// Organization permissions
export { getOrgPermissions } from './roles/organization';
// Shared role utilities
export { isSuperadmin } from './roles/shared';
export { getSpacePermissions } from './roles/space';
export { userEntries } from './roles/userEntries';
export type { PermissionsCheck } from './types';
