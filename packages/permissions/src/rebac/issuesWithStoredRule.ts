/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */

import type { ValidationIssue } from '@inixiative/json-rules';
import {
  type ActionRule,
  issuesForRuleReadsOutsideLens,
  validateActionRule,
} from '@inixiative/permissions';
import { schemaMap } from '@template/db/schemaMap';
import { rebacSchema } from '@template/permissions/rebac/schema';

type RulesByAction = Partial<Record<string, unknown>>;

/** What the library would refuse in a rule stored beside the schema's: its shape, a loop back to its own action, or a read the record does not have. */
export const issuesWithStoredRule = (
  resource: string,
  action: string,
  rule: unknown,
  storedBeside: { rowRules?: RulesByAction; additionalRules?: RulesByAction[] } = {},
): ValidationIssue[] => {
  const shape = validateActionRule(rule, {
    schema: rebacSchema,
    resource,
    action,
    ...storedBeside,
  });
  return shape.ok
    ? issuesForRuleReadsOutsideLens(schemaMap, rebacSchema, resource, rule as ActionRule)
    : shape.errors;
};
