import { check as checkRule } from '@inixiative/json-rules';
import type { AccessorName, HydratedRecord } from '@template/db';
import { isNil } from 'lodash-es';
import type { Action, Permix } from '@template/permissions/client';
import { relationTargets } from '@template/permissions/rebac/relationTargetsGen';
import type { ActionRule, RebacSchema } from '@template/permissions/rebac/types';

/**
 * Check if permix grants access via ReBAC schema traversal.
 *
 * Flow:
 * 1. Superadmin bypass (if permix.isSuperadmin)
 * 2. Direct permission check (permix.check)
 * 3. Schema delegation (action inherits from another action)
 * 4. Relation traversal (space.own → organization.own)
 * 5. JSON rule evaluation (attribute-based checks)
 */
export const check = (
  permix: Permix,
  schema: RebacSchema,
  model: AccessorName,
  record: HydratedRecord,
  actionOrRule: ActionRule,
  visited: Set<string> = new Set(),
): boolean => {
  // Superadmin bypass - check first before any other logic
  if (permix.isSuperadmin?.()) return true;

  if (isNil(actionOrRule)) return false;
  if (typeof actionOrRule === 'string') {
    if (permix.check(model, actionOrRule as Action, record.id)) return true;
    const delegateRule = schema[model]?.actions[actionOrRule] ?? null;
    return check(permix, schema, model, record, delegateRule, visited);
  }

  const rule = actionOrRule;
  if ('rel' in rule && 'action' in rule) {
    const related = record[rule.rel] as HydratedRecord | null | undefined;
    if (!related) return false;

    const targetModel = relationTargets[model]?.[rule.rel];
    if (!targetModel) return false;

    const key = `${targetModel}:${related.id}:${rule.action}`;
    if (visited.has(key)) throw new Error(`Cycle detected in permission graph: ${key}`);
    visited.add(key);

    return check(permix, schema, targetModel, related, rule.action, visited);
  }

  // { self: 'userId' } - check if record[field] matches current user
  if ('self' in rule) {
    const userId = permix.getUserId();
    return userId !== null && record[rule.self] === userId;
  }

  if ('rule' in rule) return checkRule(rule.rule, record) === true;
  if ('any' in rule) return rule.any.some((r) => check(permix, schema, model, record, r, visited));
  if ('all' in rule) return rule.all.every((r) => check(permix, schema, model, record, r, visited));

  return false;
};
