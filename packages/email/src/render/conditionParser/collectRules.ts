/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { IF } from '@template/email/render/conditionParser/grammar';
import { parseIfBlock } from '@template/email/render/conditionParser/parseIfBlock';

export const collectRules = (content: string): Condition[] => {
  const rules: Condition[] = [];
  let i = 0;
  while (i < content.length) {
    const openIdx = content.indexOf(IF, i);
    if (openIdx === -1) break;
    const block = parseIfBlock(content, openIdx);
    if (!block) {
      i = openIdx + IF.length;
      continue;
    }
    for (const branch of block.branches) {
      if (branch.rule !== undefined) rules.push(branch.rule);
      rules.push(...collectRules(branch.body));
    }
    i = block.end;
  }
  return rules;
};
