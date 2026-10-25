/**
 * @atlas
 * @kind registry
 * @partOf primitive:authz
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';

const notFullOr = (condition: Condition, error: string): Condition => ({
  any: [{ field: 'full', operator: Operator.notEquals, value: true }, condition],
  error,
});

const fullPassesAHolderThrough: Condition[] = [
  notFullOr({ field: 'role', operator: Operator.isEmpty, value: true }, 'full takes no role'),
  notFullOr(
    { field: 'entitlements', operator: Operator.isEmpty, value: true },
    'full takes no entitlements',
  ),
  notFullOr(
    { field: 'ownerModel', operator: Operator.notIn, value: ['Organization', 'Space'] },
    'an Organization or Space holds itself; give it a role, not full',
  ),
];

export const delegatePermissionRules = {
  Integration: { all: fullPassesAHolderThrough },
  Token: {
    all: [
      ...fullPassesAHolderThrough,
      {
        any: [
          { field: 'full', operator: Operator.equals, value: true },
          { field: 'role', operator: Operator.notEmpty, value: true },
          { field: 'entitlements', operator: Operator.notEmpty, value: true },
        ],
        error: 'a token that is not full has a role, entitlements or both',
      },
    ],
  },
} satisfies Record<string, Condition>;
