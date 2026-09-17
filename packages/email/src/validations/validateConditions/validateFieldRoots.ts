/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import { type Condition, checkRuleAgainstLens, type Lens, type LensNarrowing } from '@inixiative/json-rules';
import type { ConditionIssue } from '@template/email/errors/ConditionValidationError';
import { RESERVED_SCOPE_ROOTS } from '@template/email/render/conditionParser';
import type { BindingChain } from '@template/email/rules/resolveBindingPath';
import { walkConditionTree } from '@template/email/rules/walkConditionTree';
import { collectContextPathRoots } from '@template/email/validations/validateConditions/collectContextPathRoots';
import { desugarLeafForLens } from '@template/email/validations/validateConditions/desugarLeafForLens';
import type { ConditionNode } from '@template/email/validations/validateConditions/types';

export const validateFieldRoots = (
  rule: Condition,
  lens: Lens | LensNarrowing | undefined,
  bindingScope: BindingChain,
  path: string,
  issues: ConditionIssue[],
): void => {
  const bindingRoots = new Set<string>();
  const contextPathRoots = new Set<string>();
  collectContextPathRoots(rule, contextPathRoots);
  for (const root of contextPathRoots) {
    if (!RESERVED_SCOPE_ROOTS.has(root)) bindingRoots.add(root);
  }

  walkConditionTree(rule, undefined, (leaf) => {
    const node = leaf as ConditionNode;
    if (typeof node.field === 'string' && node.field) {
      const root = node.field.split('.')[0]!;
      if (!RESERVED_SCOPE_ROOTS.has(root)) bindingRoots.add(root);
    }
    if (!lens) return undefined;
    const rewritten = desugarLeafForLens(node, bindingScope);
    if (rewritten) {
      for (const violation of checkRuleAgainstLens(rewritten as Condition, lens).violations) {
        issues.push({ path: `${path}:${violation.path}`, message: violation.reason });
      }
    }
    return undefined;
  });

  for (const root of bindingRoots) {
    if (!bindingScope.has(root)) {
      issues.push({
        path,
        message: `references unknown binding "${root}" — not the current or an enclosing {{#each}}'s as=`,
      });
    }
  }
};
