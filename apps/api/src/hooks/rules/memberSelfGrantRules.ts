/**
 * @atlas
 * @kind registry
 * @partOf primitive:authz
 * @uses none
 */
import { ArrayOperator, type Condition, Operator } from '@inixiative/json-rules';
import type { MemberResource } from '@template/permissions';

const keepsItsSelfGrant = (resource: MemberResource): Condition => ({
  field: 'entitlements',
  arrayOperator: ArrayOperator.any,
  condition: {
    all: [
      { field: 'resource', operator: Operator.equals, value: resource },
      { field: 'anchor.resource', operator: Operator.equals, value: 'db:user' },
      { field: 'anchor.id', operator: Operator.equals, path: '$$.userId' },
      { field: 'anchor.path', operator: Operator.equals, value: 'user' },
      { field: 'where.field', operator: Operator.equals, value: 'id' },
      { field: 'where.operator', operator: Operator.equals, value: Operator.equals },
      { field: 'where.value', operator: Operator.equals, path: '$$.id' },
      { field: 'actions.operate', operator: Operator.equals, value: true },
    ],
  },
  error: 'a member keeps its self-grant',
});

export const memberSelfGrantRules = {
  OrganizationUser: keepsItsSelfGrant('db:organizationUser'),
  SpaceUser: keepsItsSelfGrant('db:spaceUser'),
} satisfies Record<string, Condition>;
