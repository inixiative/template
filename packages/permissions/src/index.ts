/**
 * PACKAGE INDEX FILE - Cross-package exports use relative imports.
 * All other files in this package should use absolute #/ imports.
 */

// Client
export {
  createPermissions,
  OrganizationAction,
  type Permix,
  type PermissionEntry,
  type ActionState,
  type ResourceType,
  type Action,
  type Entitlements,
} from './client';

// Roles (RBAC)
export {
  isSuperadmin,
  organizationRoles,
  roleHierarchy,
  lesserRole,
  greaterRole,
  intersectEntitlements,
  roleToOrgAction,
  getOrgPermissions,
  setupOrgContext,
} from './roles';

export { OrganizationRole } from '@template/db';
