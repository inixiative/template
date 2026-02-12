import type { AccessorName, HydratedRecord } from '@template/db';
import type { Role as PrismaRole } from '@template/db/generated/client/enums';
import type { ActionRule } from '@template/permissions/rebac/types';

export type Role = PrismaRole;

/**
 * Minimal permissions interface for consumers (UI, etc.)
 * Matches the rebac-wrapped check signature from PermissionsSlice
 */
export type PermissionsCheck = {
  check: (model: AccessorName, record: HydratedRecord, action: ActionRule) => boolean;
};
