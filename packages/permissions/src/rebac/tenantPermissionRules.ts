/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { ActionRule, AdditionalRules } from '@inixiative/permissions';
import { type BindableOwnerModel, type ModelName, relationsToTenantOnSides } from '@template/db';
import { schemaMap } from '@template/db/schemaMap';
import { tenantRowsAbove, tenantRowsOnSides } from '@template/db/utils/tenantRowsAbove';
import { StandardAction } from '@template/permissions/client';
import { issuesWithStoredRule } from '@template/permissions/rebac/issuesWithStoredRule';
import { StoredPermissionRuleRefusedError } from '@template/permissions/rebac/storedPermissionRuleRefusedError';
import { actionsTenantMayExtend } from '@template/permissions/rebac/tenantPermissionRulesLens';
import { isPlainObject, pick, pickBy } from 'lodash-es';

type RulesByAction = Record<string, ActionRule>;
type SideCheck = { rel: string; action: string };

const standardActions: readonly string[] = Object.values(StandardAction);

const isSideCheck = (part: unknown): part is SideCheck =>
  isPlainObject(part) &&
  typeof (part as SideCheck).rel === 'string' &&
  standardActions.includes((part as SideCheck).action);

/** The check on a side that a rule holds: `{ rel, action }` asking read, operate, manage or own, alone or in the rule's own `all`. */
export const sideCheckHeldBy = (rule: unknown): SideCheck | undefined => {
  const all = isPlainObject(rule) ? (rule as { all?: unknown }).all : undefined;
  return (Array.isArray(all) ? all : [rule]).find(isSideCheck);
};

/** Why a tenant's rule for a record with sides is refused: it holds no check on one of that tenant's own sides. Undefined when it does, or the record has none. */
export const reasonRuleIsOffItsOwnSide = (
  tenantModel: BindableOwnerModel,
  resource: string,
  rule: unknown,
): string | undefined => {
  const ownSides = relationsToTenantOnSides(
    schemaMap.resources[resource] as ModelName,
    tenantModel,
  );
  if (!ownSides.length || ownSides.includes(sideCheckHeldBy(rule)?.rel ?? '')) return undefined;
  const checks = ownSides.map((relation) => `{ rel: '${relation}', action }`).join(' or ');
  return `a ${tenantModel}'s rule here holds a check on its own side, asking read, operate, manage or own: ${checks}`;
};

const rulesAlreadyRead = new WeakMap<object, Map<string, RulesByAction>>();

const rulesOf = (
  row: Record<string, unknown>,
  tenantModel: BindableOwnerModel,
  resource: string,
): RulesByAction => {
  const read = rulesAlreadyRead.get(row)?.get(resource);
  if (read) return read;
  const rules = pick(
    (row.tenantPermissionRules as Record<string, RulesByAction> | null | undefined)?.[resource] ??
      {},
    actionsTenantMayExtend(tenantModel, resource),
  );
  for (const [action, rule] of Object.entries(rules)) {
    const [issue] = issuesWithStoredRule(resource, action, rule, { additionalRules: [rules] });
    const reason =
      reasonRuleIsOffItsOwnSide(tenantModel, resource, rule) ??
      (issue && `${issue.path}: ${issue.message}`);
    if (reason)
      throw new StoredPermissionRuleRefusedError(
        `a ${tenantModel}'s stored rule for \`${resource}.${action}\` is refused: ${reason}`,
      );
  }
  rulesAlreadyRead.set(row, (rulesAlreadyRead.get(row) ?? new Map()).set(resource, rules));
  return rules;
};

/**
 * The rules each tenant above a record holds for its resource (`tenantPermissionRules`), cut to
 * the actions that tenant's lens shows, for `check()` to OR in. A tenant on a side of a record
 * gives the rules whose side check is on that side. A stored rule that is refused throws.
 */
export const tenantPermissionRulesAbove: AdditionalRules = (resource, record) => [
  ...tenantRowsAbove(record).map(({ model, row }) => rulesOf(row, model, resource)),
  ...tenantRowsOnSides(schemaMap.resources[resource] as ModelName, record).map(
    ({ model, row, relation }) =>
      pickBy(rulesOf(row, model, resource), (rule) => sideCheckHeldBy(rule)?.rel === relation),
  ),
];
