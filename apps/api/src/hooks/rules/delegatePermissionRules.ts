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

const fullTakesNoRole = notFullOr(
  { field: 'role', operator: Operator.isEmpty, value: true },
  'full takes no role',
);

const fullOnlyOn = (owners: string[]): Condition =>
  notFullOr(
    { field: 'ownerModel', operator: Operator.in, value: owners },
    `full only on a delegate of ${owners.join(', ')}`,
  );

export const delegatePermissionRules = {
  Integration: { all: [fullTakesNoRole, fullOnlyOn(['User', 'OrganizationUser', 'SpaceUser'])] },
  Token: {
    all: [fullTakesNoRole, fullOnlyOn(['User', 'OrganizationUser', 'SpaceUser', 'Integration'])],
  },
} satisfies Record<string, Condition>;
