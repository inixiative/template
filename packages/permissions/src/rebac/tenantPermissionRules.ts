/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { ActionRule, AdditionalRules } from '@inixiative/permissions';
import type { BindableOwnerModel, ModelName } from '@template/db';
import { schemaMap } from '@template/db/schemaMap';
import { tenantRowsAbove, tenantRowsOnSides } from '@template/db/utils/tenantRowsAbove';
import { StandardAction } from '@template/permissions/client';
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

const rulesOf = (row: Record<string, unknown>, tenantModel: BindableOwnerModel, resource: string) =>
  pick(
    (row.tenantPermissionRules as RulesByResource | null | undefined)?.[resource] ?? {},
    actionsTenantMayExtend(tenantModel, resource),
  );

/**
 * The rules each tenant above a record holds for its resource (`tenantPermissionRules`), cut to
 * the actions that tenant's lens shows, for `check()` to OR in. A tenant on a side of a two-sided
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
