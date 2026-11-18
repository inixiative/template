/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses primitive:authz
 */
import type { AccessorName, HydratedRecord } from '@template/db';
import type { ActionRule } from '@template/permissions/rebac/types';
import type { PermissionsSlice } from '@template/ui/store/types';

export const canActOnRecordIfPresent = (
  permissions: PermissionsSlice['permissions'],
  model: AccessorName,
  record: HydratedRecord | null | undefined,
  action: ActionRule,
): boolean => {
  if (!record) return false;
  return permissions.check(model, record, action);
};
