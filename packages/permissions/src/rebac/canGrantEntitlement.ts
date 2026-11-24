/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { makeCanGrantEntitlement } from '@inixiative/permissions';
import { schemaMap } from '@template/permissions/rebac/schema';
import { tenantPermissionRulesAbove } from '@template/permissions/rebac/tenantPermissionRules';

export const canGrantEntitlement = makeCanGrantEntitlement(schemaMap, {
  additionalRules: tenantPermissionRulesAbove,
});
