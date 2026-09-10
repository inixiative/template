/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';

export type ParsedRule = { rule: Condition; ruleError?: never } | { rule?: never; ruleError: string };

export const parseRuleJson = (text: string): ParsedRule => {
  try {
    return { rule: JSON.parse(text) as Condition };
  } catch (err) {
    return { ruleError: `invalid rule JSON: ${(err as SyntaxError).message}` };
  }
};
