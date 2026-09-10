/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { ELSE, ELSE_IF, END, IF } from '@template/email/render/conditionParser/grammar';
import { readRuleMarker } from '@template/email/render/conditionParser/readRuleMarker';
import type { Branch, IfBlock } from '@template/email/render/conditionParser/types';

export const parseIfBlock = (content: string, openIdx: number): IfBlock | null => {
  const open = readRuleMarker(content, openIdx, IF);
  if (!open) return null;

  const branches: Branch[] = [];
  let current: { kind: Branch['kind']; rule?: Condition; ruleError?: string; bodyStart: number } = {
    kind: 'if',
    rule: open.rule,
    ruleError: open.ruleError,
    bodyStart: open.next,
  };
  const closeCurrent = (bodyEnd: number) =>
    branches.push({
      kind: current.kind,
      rule: current.rule,
      ruleError: current.ruleError,
      body: content.slice(current.bodyStart, bodyEnd),
    });

  let depth = 1;
  let i = open.next;
  while (i < content.length) {
    if (content.startsWith(IF, i)) {
      const nested = readRuleMarker(content, i, IF);
      if (nested) {
        depth++;
        i = nested.next;
        continue;
      }
      i += IF.length;
      continue;
    }
    if (content.startsWith(END, i)) {
      depth--;
      if (depth === 0) {
        closeCurrent(i);
        return { branches, end: i + END.length };
      }
      i += END.length;
      continue;
    }
    if (content.startsWith(ELSE_IF, i)) {
      const marker = readRuleMarker(content, i, ELSE_IF);
      if (marker) {
        if (depth === 1) {
          closeCurrent(i);
          current = { kind: 'elseIf', rule: marker.rule, ruleError: marker.ruleError, bodyStart: marker.next };
        }
        i = marker.next;
        continue;
      }
      i += ELSE_IF.length;
      continue;
    }
    if (content.startsWith(ELSE, i)) {
      if (depth === 1) {
        closeCurrent(i);
        current = { kind: 'else', bodyStart: i + ELSE.length };
      }
      i += ELSE.length;
      continue;
    }
    i++;
  }
  return null;
};
