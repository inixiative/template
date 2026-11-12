/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { visitTemplateBlocks } from '@template/email/render/conditionParser/visitTemplateBlocks';
import type { EmailLens } from '@template/email/rules/emailLens';
import type { BindingChain } from '@template/email/rules/resolveBindingPath';
import { scopedRule } from '@template/email/rules/scopedRule';

const push = (
  out: Condition[],
  rule: Condition | undefined,
  bindings: BindingChain,
  lens?: EmailLens,
): void => {
  if (rule === undefined) return;
  const { rule: judged } = scopedRule(rule, bindings, { lens });
  if (judged) out.push(judged);
};

/**
 * Every rule the content evaluates — `{{#if}}` branches and `{{#each filter=}}` — a loop-bound
 * rule as the array rule the lens judges (`scopedRule`). A rule reading a loop index, the element
 * itself or another lens's root has no shape in the lens and is left out.
 */
export const collectRules = (
  content: string,
  bindings: BindingChain = new Map(),
  lens?: EmailLens,
): Condition[] => {
  const rules: Condition[] = [];
  visitTemplateBlocks(
    content,
    {
      branch: ({ rule }, _branchIndex, _position, scope) => {
        push(rules, rule, scope.bindings, lens);
      },
      loop: ({ filter }, loop) => {
        push(rules, filter, loop.bindings, lens);
      },
    },
    { bindings, state: undefined },
  );
  return rules;
};
