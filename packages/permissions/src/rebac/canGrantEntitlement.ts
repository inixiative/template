/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { createCanGrantEntitlement, type EntitlementEntry } from '@inixiative/permissions';
import type { HydratedRecord } from '@template/db';
import type { Permix } from '@template/permissions/client';
import { schemaMap } from '@template/permissions/rebac/schema';
import { tenantPermissionRulesAbove } from '@template/permissions/rebac/tenantPermissionRules';

const canGrant = createCanGrantEntitlement(schemaMap, {
  additionalRules: tenantPermissionRulesAbove,
});

export const canGrantEntitlement = (
  permix: Permix,
  entry: EntitlementEntry,
  pseudoRecord: HydratedRecord,
): boolean => canGrant(permix, entry, pseudoRecord);
