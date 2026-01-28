/**
 * PACKAGE INDEX FILE - Cross-package exports use relative imports.
 * All other files in this package should use absolute #/ imports.
 */

// Client
export {
  createPermissions,
  StandardAction,
  OrganizationAction,
  UserAction,
  type Permix,
  type PermissionEntry,
  type ActionState,
  type ResourceType,
  type Action,
  type Entitlements,
} from './client';

// Shared role utilities
export {
  isSuperadmin,
  roleHierarchy,
  lesserRole,
  greaterRole,
  intersectEntitlements,
  allTrue,
} from './roles/shared';

// Organization permissions
export {
  organizationRoles,
  getOrgPermissions,
  setupOrgContext,
  roleToOrgAction,
} from './roles/organization';

// User permissions
export {
  userRoles,
  getUserPermissions,
  setupUserContext,
} from './roles/user';

export { OrganizationRole } from '@template/db';
