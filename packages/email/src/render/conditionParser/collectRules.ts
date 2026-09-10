/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { EACH, IF } from '@template/email/render/conditionParser/grammar';
import { parseEachBlock } from '@template/email/render/conditionParser/parseEachBlock';
import { parseIfBlock } from '@template/email/render/conditionParser/parseIfBlock';
import { absoluteRule } from '@template/email/rules/absoluteRule';
import { type BindingChain, resolveBindingPath } from '@template/email/rules/resolveBindingPath';

const push = (out: Condition[], rule: Condition | undefined, bindings: BindingChain): void => {
  if (rule === undefined) return;
  const judged = absoluteRule(rule, bindings);
  if (judged !== undefined) out.push(judged);
};

/**
 * Every rule the content evaluates — `{{#if}}` branches and `{{#each filter=}}` — with loop
 * bindings resolved to the absolute paths the lens can judge. A rule reading a loop index has no
 * path in the lens and is left out.
 */
export const collectRules = (content: string, bindings: BindingChain = new Map()): Condition[] => {
  const rules: Condition[] = [];
  let i = 0;
  while (i < content.length) {
    const ifIdx = content.indexOf(IF, i);
    const eachIdx = content.indexOf(EACH, i);
    if (ifIdx === -1 && eachIdx === -1) break;
    const kind: 'if' | 'each' = eachIdx === -1 || (ifIdx !== -1 && ifIdx < eachIdx) ? 'if' : 'each';
    const openIdx = kind === 'if' ? ifIdx : eachIdx;

    if (kind === 'if') {
      const block = parseIfBlock(content, openIdx);
      if (!block) {
        i = openIdx + IF.length;
        continue;
      }
      for (const branch of block.branches) {
        push(rules, branch.rule, bindings);
        rules.push(...collectRules(branch.body, bindings));
      }
      i = block.end;
      continue;
    }

    const block = parseEachBlock(content, openIdx);
    if (!block) {
      i = openIdx + EACH.length;
      continue;
    }
    const next: BindingChain = new Map(bindings);
    if (block.as) next.set(block.as, resolveBindingPath(block.path, bindings));
    if (block.index) next.set(block.index, undefined);
    push(rules, block.filter, next);
    rules.push(...collectRules(block.body, next));
    i = block.end;
  }
  return rules;
};
