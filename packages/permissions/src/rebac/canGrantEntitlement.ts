/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { makeCanGrantEntitlement } from '@inixiative/permissions';
import { schemaMap } from '@template/permissions/rebac/schema';
import { storedPermissionRules } from '@template/permissions/rebac/storedPermissionRules';

export const canGrantEntitlement = makeCanGrantEntitlement(schemaMap, {
  additionalRules: storedPermissionRules,
});
