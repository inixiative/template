/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Role } from '@template/db/generated/client/enums';
import type { EntitlementEntry } from '@template/permissions/client';

export type DelegatePermissions = {
  role: Role | null;
  full: boolean;
  entitlements: EntitlementEntry[] | null;
};
