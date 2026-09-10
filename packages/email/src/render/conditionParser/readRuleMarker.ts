/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { findJsonEnd } from '@template/email/render/conditionParser/findJsonEnd';
import { parseRuleJson } from '@template/email/render/conditionParser/parseRuleJson';
import { skipWhitespace } from '@template/email/render/conditionParser/skipWhitespace';

export type RuleMarker = { rule?: Condition; ruleError?: string; next: number };

export const readRuleMarker = (content: string, i: number, token: string): RuleMarker | null => {
  const jsonStart = skipWhitespace(content, i + token.length);

  let valueEnd: number;
  let markerEnd: number;
  if (content[jsonStart] === '{') {
    const braceEnd = findJsonEnd(content, jsonStart);
    const afterJson = braceEnd === -1 ? -1 : skipWhitespace(content, braceEnd + 1);
    if (afterJson !== -1 && content.slice(afterJson, afterJson + 2) === '}}') {
      valueEnd = braceEnd + 1;
      markerEnd = afterJson;
    } else {
      const close = content.indexOf('}}', jsonStart);
      if (close === -1) return null;
      valueEnd = close;
      markerEnd = close;
    }
  } else {
    const close = content.indexOf('}}', jsonStart);
    if (close === -1) return null;
    valueEnd = close;
    markerEnd = close;
  }

  if (content.slice(markerEnd, markerEnd + 2) !== '}}') return null;

  return { ...parseRuleJson(content.slice(jsonStart, valueEnd).trim()), next: markerEnd + 2 };
};
