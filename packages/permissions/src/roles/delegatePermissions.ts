/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { EntitlementInput } from '@template/db/entitlements/entitlementRow';
import type { Role } from '@template/db/generated/client/enums';

export type DelegatePermissions = {
  role: Role | null;
  full: boolean;
  entitlements: EntitlementInput[] | null;
};
