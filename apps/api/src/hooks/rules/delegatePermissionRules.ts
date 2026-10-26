/**
 * @atlas
 * @kind registry
 * @partOf primitive:authz
 * @uses none
 */
import { ArrayOperator, type Condition, Operator } from '@inixiative/json-rules';

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

const filled = (field: string): Condition => ({
  field,
  operator: Operator.notEmpty,
  value: true,
});

const entitlementsAreEntries: Condition = {
  any: [
    { field: 'entitlements', operator: Operator.isEmpty, value: true },
    {
      field: 'entitlements',
      arrayOperator: ArrayOperator.all,
      condition: {
        all: [
          filled('resource'),
          filled('anchor.resource'),
          filled('anchor.id'),
          filled('actions'),
        ],
      },
    },
  ],
  error: 'entitlements are entries: { resource, anchor, actions }',
};

export const delegatePermissionRules = {
  Integration: {
    all: [
      entitlementsAreEntries,
      ...fullTakesNothingElse,
      fullOnlyOn(['User', 'OrganizationUser', 'SpaceUser']),
    ],
  },
  OrganizationUser: entitlementsAreEntries,
  SpaceUser: entitlementsAreEntries,
  Token: {
    all: [
      entitlementsAreEntries,
      ...fullTakesNothingElse,
      fullOnlyOn(['User', 'OrganizationUser', 'SpaceUser', 'Integration']),
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
