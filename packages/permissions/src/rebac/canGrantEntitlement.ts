/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { createCanGrantEntitlement, type EntitlementEntry } from '@inixiative/permissions';
import type { HydratedRecord } from '@template/db';
import { schemaMap } from '@template/db/schemaMap';
import type { Permix } from '@template/permissions/client';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { rethrowingARefusedStoredRule } from '@template/permissions/rebac/storedPermissionRuleRefusedError';
import { tenantPermissionRulesAbove } from '@template/permissions/rebac/tenantPermissionRules';

const canGrant = createCanGrantEntitlement(schemaMap, {
  additionalRules: tenantPermissionRulesAbove,
});

export const canGrantEntitlement = (
  permix: Permix,
  entry: EntitlementEntry,
  placed: HydratedRecord,
): boolean => rethrowingARefusedStoredRule(() => canGrant(permix, rebacSchema, entry, placed));
