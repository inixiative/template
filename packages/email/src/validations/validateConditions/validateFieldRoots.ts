/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Condition } from '@inixiative/json-rules';
import type { ConditionIssue } from '@template/email/errors/ConditionValidationError';
import { RESERVED_SCOPE_ROOTS } from '@template/email/render/conditionParser';
import { type EmailLens, emailRuleViolations } from '@template/email/rules/emailLens';
import type { BindingChain } from '@template/email/rules/resolveBindingPath';
import { scopedRule } from '@template/email/rules/scopedRule';
import { walkConditionTree } from '@template/email/rules/walkConditionTree';
import { collectContextPathRoots } from '@template/email/validations/validateConditions/collectContextPathRoots';
import type { ConditionNode } from '@template/email/validations/validateConditions/types';

export const validateFieldRoots = (
  rule: Condition,
  lens: EmailLens | undefined,
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
    return undefined;
  });

  const unknown = [...bindingRoots].filter((root) => !bindingScope.has(root));
  for (const root of unknown) {
    issues.push({
      path,
      message: `references unknown binding "${root}" — not the current or an enclosing {{#each}}'s as=`,
    });
  }
  if (unknown.length) return;

  const scoped = scopedRule(rule, bindingScope, { lens });
  if (scoped.issue !== undefined) {
    issues.push({ path, message: scoped.issue });
    return;
  }
  if (!lens) return;
  for (const violation of emailRuleViolations(lens, scoped.rule)) {
    issues.push({ path: `${path}:${violation.path}`, message: violation.reason });
  }
};
