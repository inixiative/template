/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import {
  type ActionRule,
  type AdditionalRules,
  issuesForRuleReadsOutsideLens,
  validateActionRule,
} from '@inixiative/permissions';
import type { BindableOwnerModel, ModelName } from '@template/db';
import { schemaMap } from '@template/db/schemaMap';
import { tenantRowsAbove, tenantRowsOnSides } from '@template/db/utils/tenantRowsAbove';
import { StandardAction } from '@template/permissions/client';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { StoredPermissionRuleRefusedError } from '@template/permissions/rebac/storedPermissionRuleRefusedError';
import { actionsTenantMayExtend } from '@template/permissions/rebac/tenantPermissionRulesLens';
import { pick, pickBy } from 'lodash-es';

type RulesByResource = Record<string, Record<string, ActionRule>>;

const standardActions: readonly string[] = Object.values(StandardAction);

/** Whether every way through `rule` asks a standard action on `relation`: the walk itself, an `all` holding one, or an `any` of nothing else. */
export const ruleAsksStandardActionThroughRelation = (rule: unknown, relation: string): boolean => {
  if (rule === null || typeof rule !== 'object') return false;
  const node = rule as { rel?: unknown; action?: unknown; all?: unknown[]; any?: unknown[] };
  if (typeof node.action === 'string')
    return node.rel === relation && standardActions.includes(node.action);
  if (Array.isArray(node.all))
    return node.all.some((part) => ruleAsksStandardActionThroughRelation(part, relation));
  if (Array.isArray(node.any))
    return (
      node.any.length > 0 &&
      node.any.every((part) => ruleAsksStandardActionThroughRelation(part, relation))
    );
  return false;
};

const rulesAlreadyRead = new WeakMap<object, Map<string, Record<string, ActionRule>>>();

const throwIfTheLibraryWouldRefuse = (
  rules: Record<string, ActionRule>,
  tenantModel: BindableOwnerModel,
  resource: string,
) => {
  for (const [action, rule] of Object.entries(rules)) {
    const [issue] = [
      ...validateActionRule(rule, {
        schema: rebacSchema,
        resource,
        action,
        additionalRules: [rules],
      }).errors,
      ...issuesForRuleReadsOutsideLens(schemaMap, rebacSchema, resource, rule),
    ];
    if (issue)
      throw new StoredPermissionRuleRefusedError(
        `a ${tenantModel}'s stored rule for \`${resource}.${action}\` is refused: ${issue.path}: ${issue.message}`,
      );
  }
};

const rulesOf = (
  row: Record<string, unknown>,
  tenantModel: BindableOwnerModel,
  resource: string,
): Record<string, ActionRule> => {
  const read = rulesAlreadyRead.get(row)?.get(resource);
  if (read) return read;
  const rules = pick(
    (row.tenantPermissionRules as RulesByResource | null | undefined)?.[resource] ?? {},
    actionsTenantMayExtend(tenantModel, resource),
  );
  throwIfTheLibraryWouldRefuse(rules, tenantModel, resource);
  rulesAlreadyRead.set(row, (rulesAlreadyRead.get(row) ?? new Map()).set(resource, rules));
  return rules;
};

/**
 * The rules each tenant above a record holds for its resource (`tenantPermissionRules`), cut to
 * the actions that tenant's lens shows, for `check()` to OR in. One the library would refuse
 * throws here, before the check. A tenant on a side of a two-sided
 * record gives only the rules that ask a standard action through its own side.
 */
export const tenantPermissionRulesAbove: AdditionalRules = (resource, record) => [
  ...tenantRowsAbove(record).map(({ model, row }) => rulesOf(row, model, resource)),
  ...tenantRowsOnSides(schemaMap.resources[resource] as ModelName, record).map(
    ({ model, row, relation }) =>
      pickBy(rulesOf(row, model, resource), (rule) =>
        ruleAsksStandardActionThroughRelation(rule, relation),
      ),
  ),
];
