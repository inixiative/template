/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { type BindingChain, resolveBindingPath } from '@template/email/rules/resolveBindingPath';

type Node = Record<string, unknown>;

const rewrite = (value: unknown, bindings: BindingChain): string | undefined | null => {
  if (typeof value !== 'string' || !value) return null;
  return resolveBindingPath(value, bindings);
};

const absoluteNode = (condition: Condition, bindings: BindingChain): Condition | undefined => {
  if (condition == null || typeof condition === 'boolean') return condition;
  const node = condition as Node;

  for (const key of ['all', 'any'] as const) {
    if (!Array.isArray(node[key])) continue;
    const children: Condition[] = [];
    for (const child of node[key] as Condition[]) {
      const out = absoluteNode(child, bindings);
      if (out === undefined) return undefined;
      children.push(out);
    }
    return { ...node, [key]: children } as Condition;
  }
  if ('if' in node) {
    const out: Node = { ...node };
    for (const key of ['if', 'then', 'else'] as const) {
      if (node[key] === undefined) continue;
      const child = absoluteNode(node[key] as Condition, bindings);
      if (child === undefined) return undefined;
      out[key] = child;
    }
    return out as Condition;
  }

  const out: Node = { ...node };
  const field = rewrite(node.field, bindings);
  if (field === undefined) return undefined;
  if (field !== null) out.field = field;
  if (typeof node.path === 'string' && !node.path.startsWith('$.')) {
    const path = rewrite(node.path, bindings);
    if (path === undefined) return undefined;
    if (path !== null) out.path = path;
  }
  return out as Condition;
};

/**
 * The rule with every loop binding replaced by the absolute path it stands for, so the lens can judge
 * it. `undefined` when a leaf reads an index binding, which has no path in the lens.
 */
export const absoluteRule = (rule: Condition, bindings: BindingChain | undefined): Condition | undefined =>
  bindings?.size ? absoluteNode(rule, bindings) : rule;
