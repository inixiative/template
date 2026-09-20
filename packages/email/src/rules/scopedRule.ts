/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { RESERVED_SCOPE_ROOTS } from '@template/email/render/conditionParser';
import type { BindingChain } from '@template/email/rules/resolveBindingPath';

export type { BindingChain } from '@template/email/rules/resolveBindingPath';

export type LoopFrame = { as: string; path: string };

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value);

const splitHead = (ref: string): { head: string; rest: string } => {
  const dot = ref.indexOf('.');
  return dot === -1 ? { head: ref, rest: '' } : { head: ref.slice(0, dot), rest: ref.slice(dot + 1) };
};

const climb = (levels: number, rest: string): string => (levels === 0 ? rest : `${'$'.repeat(levels + 1)}.${rest}`);

export const loopFrames = (bindings: BindingChain): LoopFrame[] =>
  [...bindings].flatMap(([as, path]) => (path ? [{ as, path }] : []));

type Scope = { frames: LoopFrame[]; bindings: BindingChain; root: string | undefined };

/** Where a ref lands, seen from a condition `depth` array scopes below the innermost loop element. */
const rewriteRef = (ref: string, depth: number, { frames, bindings, root }: Scope): string | undefined | null => {
  if (ref.startsWith('$')) return null;
  const { head, rest } = splitHead(ref);
  if (bindings.has(head)) {
    const frame = frames.findIndex((candidate) => candidate.as === head);
    if (frame === -1 || !rest) return undefined;
    return climb(frames.length - 1 - frame + depth, rest);
  }
  if (head === root) return rest ? climb(frames.length + depth, rest) : undefined;
  if (RESERVED_SCOPE_ROOTS.has(head)) return undefined;
  return null;
};

const rewriteNode = (condition: Condition, depth: number, scope: Scope): Condition | undefined => {
  if (!isNode(condition)) return condition;
  const node = condition as Node;
  for (const key of ['all', 'any'] as const) {
    if (!Array.isArray(node[key])) continue;
    const children: Condition[] = [];
    for (const child of node[key] as Condition[]) {
      const out = rewriteNode(child, depth, scope);
      if (out === undefined) return undefined;
      children.push(out);
    }
    return { ...node, [key]: children } as Condition;
  }
  if ('if' in node) {
    const out: Node = { ...node };
    for (const key of ['if', 'then', 'else'] as const) {
      if (node[key] === undefined) continue;
      const child = rewriteNode(node[key] as Condition, depth, scope);
      if (child === undefined) return undefined;
      out[key] = child;
    }
    return out as Condition;
  }
  const out: Node = { ...node };
  for (const key of ['field', 'path'] as const) {
    if (typeof node[key] !== 'string') continue;
    const rewritten = rewriteRef(node[key] as string, depth, scope);
    if (rewritten === undefined) return undefined;
    if (rewritten !== null) out[key] = rewritten;
  }
  for (const key of ['condition', 'filter'] as const) {
    if (node[key] === undefined) continue;
    const child = rewriteNode(node[key] as Condition, depth + 1, scope);
    if (child === undefined) return undefined;
    out[key] = child;
  }
  return out as Condition;
};

const relativeTo = (path: string, enclosing: string | undefined): string | null =>
  enclosing !== undefined && path.startsWith(`${enclosing}.`) ? path.slice(enclosing.length + 1) : null;

/**
 * The array rule a loop-bound rule has always been: one `any` per enclosing `{{#each}}`, the
 * innermost body as its condition, binding leaves element-relative and root leaves climbing with
 * `$$`. Undefined when a leaf reads a loop index, the element itself, or another lens's root.
 */
export const scopedRule = (rule: Condition, bindings: BindingChain | undefined): Condition | undefined => {
  if (!bindings?.size) return rule;
  const frames = loopFrames(bindings);
  const root = frames.length ? splitHead(frames[0]!.path).head : undefined;
  const scope: Scope = { frames, bindings, root };
  let out = rewriteNode(rule, 0, scope);
  if (out === undefined) return undefined;
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const frame = frames[index]!;
    const relative = relativeTo(frame.path, frames[index - 1]?.path);
    const field = index === 0 ? frame.path : (relative ?? climb(index, splitHead(frame.path).rest));
    if (index > 0 && relative === null && splitHead(frame.path).head !== root) return undefined;
    out = { field, arrayOperator: 'any', condition: out } as Condition;
  }
  return out;
};

const setAt = (target: unknown, path: string, value: unknown): unknown => {
  const { head, rest } = splitHead(path);
  const base = isNode(target) ? target : {};
  return { ...base, [head]: rest ? setAt(base[head], rest, value) : value };
};

/** The scope with every iterated collection pinned to the element in scope, binding names dropped. */
export const narrowToElements = (scope: Record<string, unknown>, frames: LoopFrame[]): Record<string, unknown> => {
  const out: Record<string, unknown> = Object.fromEntries(
    Object.entries(scope).filter(([key]) => !frames.some((frame) => frame.as === key)),
  );
  if (!frames.length) return out;
  let pinned: unknown = scope[frames[frames.length - 1]!.as];
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const frame = frames[index]!;
    const relative = relativeTo(frame.path, frames[index - 1]?.path);
    if (index > 0 && relative !== null) {
      pinned = setAt(scope[frames[index - 1]!.as], relative, [pinned]);
      continue;
    }
    Object.assign(out, setAt(out, frame.path, [pinned]));
    pinned = index > 0 ? scope[frames[index - 1]!.as] : pinned;
  }
  return out;
};
