import type { AccessorName, HydratedRecord } from '@template/db';
import type { ActionRule } from '@template/permissions';
import type { PermissionsSlice } from '@template/shared/store';

export type PermissionCheck = {
  show: boolean;
  disable: boolean;
  disabledText?: string;
};

type UsePermissionParams = {
  permissions: PermissionsSlice['permissions'];
  model: AccessorName;
  record: HydratedRecord | null | undefined;
  action: ActionRule;
  disabledText?: string;
  requireRecord?: boolean;
};

export const usePermission = ({
  permissions,
  model,
  record,
  action,
  disabledText = 'You do not have permission to perform this action',
  requireRecord = true,
}: UsePermissionParams): PermissionCheck => {
  // If record is required but missing, hide the action
  if (requireRecord && !record) {
    return {
      show: false,
      disable: true,
      disabledText,
    };
  }

  // Check permission
  const hasPermission = record ? permissions.check(model, record, action) : false;

  return {
    show: hasPermission,
    disable: !hasPermission,
    disabledText: hasPermission ? undefined : disabledText,
  };
};

export const checkPermission = (
  permissions: PermissionsSlice['permissions'],
  model: AccessorName,
  record: HydratedRecord | null | undefined,
  action: ActionRule,
): boolean => {
  if (!record) return false;
  return permissions.check(model, record, action);
};
