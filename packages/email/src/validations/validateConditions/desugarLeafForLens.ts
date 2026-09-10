/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import { RESERVED_SCOPE_ROOTS } from '@template/email/render/conditionParser';
import { type BindingChain, resolveBindingPath } from '@template/email/rules/resolveBindingPath';
import type { ConditionNode } from '@template/email/validations/validateConditions/types';

export const desugarLeafForLens = (node: ConditionNode, bindingScope: BindingChain): ConditionNode | undefined => {
  if (typeof node.field !== 'string' || !node.field) return undefined;
  const rewritten: ConditionNode = { ...node };
  for (const key of ['field', 'path'] as const) {
    const raw = node[key];
    if (typeof raw !== 'string' || !raw) continue;
    const resolved = resolveBindingPath(raw, bindingScope);
    if (resolved === undefined) return undefined;
    if (!RESERVED_SCOPE_ROOTS.has(resolved.split('.')[0]!)) return undefined;
    rewritten[key] = resolved;
  }
  return rewritten;
};
