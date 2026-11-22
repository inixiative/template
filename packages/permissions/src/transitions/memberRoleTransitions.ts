/**
 * @atlas
 * @kind constant
 * @partOf primitive:authz, feature:tenancy
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { Action } from '@inixiative/transitions';
import { memberRoleWrite } from '@template/permissions/rebac/rebacSchemaRules';

export const memberRoleTransitions = (
  tenant: 'organization' | 'space',
): Record<string, Action> => ({
  changeRole: {
    paths: [
      {
        from: {
          predicate: { field: 'id', operator: Operator.exists },
          permission: memberRoleWrite(tenant),
        },
        to: {
          predicate: { field: 'role', operator: Operator.exists },
          permission: memberRoleWrite(tenant),
        },
      },
    ],
  },
});
