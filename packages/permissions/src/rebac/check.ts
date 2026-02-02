import type { AccessorName, HydratedRecord, ModelName } from '@template/db';
import { getModelRelations, toAccessor, toModelName } from '@template/db';
import { check as checkRule } from '@inixiative/json-rules';
import { isNil } from 'lodash-es';
import type { Action, Permix } from '../client';
import type { ActionRule, RebacSchema } from './types';

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

    const modelName = toModelName(model);
    if (!modelName) return false;
    const relations = getModelRelations(modelName);
    const relation = relations.find((r) => r.relationName === rule.rel);
    if (!relation) return false;
    const targetModel = toAccessor(relation.targetModel as ModelName);

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
