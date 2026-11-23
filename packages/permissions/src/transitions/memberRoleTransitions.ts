/**
 * @atlas
 * @kind constant
 * @partOf primitive:authz, feature:tenancy
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { Action } from '@inixiative/transitions';
import { memberRoleWrite } from '@template/permissions/rebac/rebacSchemaRules';
import { updating } from '@template/permissions/transitions/utils';
import { notDeleted } from '@template/shared/rules';

export const memberRoleTransitions = (
  tenant: 'organization' | 'space',
): Record<string, Action> => ({
  changeRole: {
    paths: [
      {
        from: {
          predicate: updating,
          permission: memberRoleWrite(tenant),
        },
        to: {
          predicate: { all: [notDeleted, { field: 'role', operator: Operator.exists }] },
          permission: memberRoleWrite(tenant),
        },
      },
    ],
  },
});
