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

const fullTakesNothingElse: Condition[] = [
  notFullOr({ field: 'role', operator: Operator.isEmpty, value: true }, 'full takes no role'),
  notFullOr(
    { field: 'entitlements', operator: Operator.isEmpty, value: true },
    'full takes no entitlements',
  ),
];

const fullOnlyOn = (owners: string[]): Condition =>
  notFullOr(
    { field: 'ownerModel', operator: Operator.in, value: owners },
    `full only on a delegate of ${owners.join(', ')}`,
  );

export const delegateHoldsSomething: Condition = {
  any: [
    { field: 'full', operator: Operator.equals, value: true },
    { field: 'role', operator: Operator.notEmpty, value: true },
    { field: 'entitlements', operator: Operator.notEmpty, value: true },
  ],
  error: 'a delegate that is not full has a role, entitlements or both',
};

export const delegatePermissionRules = {
  Integration: {
    all: [
      ...fullTakesNothingElse,
      fullOnlyOn(['User', 'OrganizationUser', 'SpaceUser']),
      delegateHoldsSomething,
    ],
  },
  Token: {
    all: [
      ...fullTakesNothingElse,
      fullOnlyOn(['User', 'OrganizationUser', 'SpaceUser', 'Integration']),
      delegateHoldsSomething,
    ],
  },
  Member: delegateHoldsSomething,
} satisfies Record<string, Condition>;
