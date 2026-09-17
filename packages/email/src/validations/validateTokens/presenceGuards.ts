/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';

const PRESENCE_OPERATORS = new Set(['exists', 'notEmpty']);

const guardsOf = (condition: Condition, out: Set<string>): void => {
  if (condition == null || typeof condition === 'boolean') return;
  const node = condition as Record<string, unknown>;
  if (Array.isArray(node.all)) {
    for (const child of node.all as Condition[]) guardsOf(child, out);
    return;
  }
  if (Array.isArray(node.any) || 'if' in node || 'arrayOperator' in node || 'aggregate' in node) return;
  if (typeof node.field !== 'string' || !node.field) return;
  const operator = node.operator;
  if (PRESENCE_OPERATORS.has(operator as string)) out.add(node.field);
  if (operator === 'isDefined' && node.value === true) out.add(node.field);
};

/** The absolute paths a branch body may rely on being present: presence leaves conjoined at the top of the rule. */
export const presenceGuards = (rule: Condition): Set<string> => {
  const out = new Set<string>();
  guardsOf(rule, out);
  return out;
};
