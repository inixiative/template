/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { type Condition, check } from '@inixiative/json-rules';
import { RESERVED_SCOPE_ROOTS } from '@template/email/render/conditionParser';
import { type EmailLens, OPAQUE_SLOT, slotOf, splitRoot } from '@template/email/rules/emailLens';
import type { BindingChain } from '@template/email/rules/resolveBindingPath';

export type { BindingChain } from '@template/email/rules/resolveBindingPath';

export type LoopFrame = { as: string; path: string };

export type ScopedRule = { rule: Condition; issue?: undefined } | { rule?: undefined; issue: string };

class Unsupported extends Error {}

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value);

const climb = (levels: number, rest: string): string => (levels === 0 ? rest : `${'$'.repeat(levels + 1)}.${rest}`);

/** A bare `path` is the root context in json-rules, so the current element is `$.` and every climb is one `$` longer than a field's. */
const climbPath = (levels: number, rest: string): string => `${'$'.repeat(levels + 1)}.${rest}`;

export const loopFrames = (bindings: BindingChain): LoopFrame[] =>
  [...bindings].flatMap(([as, path]) => (path ? [{ as, path }] : []));

/** The index counters in scope, read off the render scope for the bindings that carry no path. */
export const loopIndices = (scope: Record<string, unknown>, bindings: BindingChain): Indices =>
  Object.fromEntries(
    [...bindings].filter(([, path]) => !path).map(([name]) => [name, scope[name] as number | undefined]),
  );

export type Indices = Record<string, number | undefined>;

export type ScopedRuleOptions = { lens?: EmailLens; indices?: Indices };

type Scope = { frames: LoopFrame[]; bindings: BindingChain; root: string | undefined; indices?: Indices };

/** Where a ref lands, seen from a condition `depth` array scopes below the innermost loop element; null = as written. */
const rewriteRef = (ref: string, depth: number, { frames, bindings, root }: Scope, up: typeof climb): string | null => {
  if (ref.startsWith('$')) return null;
  const { root: head, rest } = splitRoot(ref);
  if (bindings.has(head)) {
    const frame = frames.findIndex((candidate) => candidate.as === head);
    if (frame === -1)
      throw new Unsupported(`"${ref}" reads a loop index as a path; an index can only be a rule's field`);
    if (!rest) throw new Unsupported(`"${ref}" names the loop element itself; name a field of it`);
    return up(frames.length - 1 - frame + depth, rest);
  }
  if (head === root) {
    if (!rest) throw new Unsupported(`"${ref}" names a lens, not a field`);
    return up(frames.length + depth, rest);
  }
  if (RESERVED_SCOPE_ROOTS.has(head)) {
    throw new Unsupported(
      `"${ref}" reads the ${head} lens from inside a loop over ${root}; a rule inside {{#each}} can only read its loop bindings and the lens it iterates`,
    );
  }
  return null;
};

/** A leaf on a loop index is a counter, not a lens path: true while nothing is iterating, its verdict once something is. */
const isIndex = (field: string, { bindings, frames }: Scope): boolean =>
  bindings.has(field) && !frames.some((frame) => frame.as === field);

const indexLeaf = (field: string, scope: Scope): null => {
  if (isIndex(field, scope) && scope.indices && scope.indices[field] === undefined) {
    throw new Unsupported(`"${field}" is a loop index and is not available here`);
  }
  return null;
};

const rewriteNode = (condition: Condition, depth: number, scope: Scope): Condition => {
  if (!isNode(condition)) return condition;
  const node = condition as Node;
  for (const key of ['all', 'any'] as const) {
    if (!Array.isArray(node[key])) continue;
    return { ...node, [key]: (node[key] as Condition[]).map((child) => rewriteNode(child, depth, scope)) } as Condition;
  }
  if ('if' in node) {
    const out: Node = { ...node };
    for (const key of ['if', 'then', 'else'] as const) {
      if (node[key] !== undefined) out[key] = rewriteNode(node[key] as Condition, depth, scope);
    }
    return out as Condition;
  }
  const out: Node = { ...node };
  if (typeof node.field === 'string' && indexLeaf(node.field, scope) === null && isIndex(node.field, scope)) {
    return scope.indices ? check(node as Condition, { [node.field]: scope.indices[node.field] }) === true : true;
  }
  for (const key of ['field', 'path'] as const) {
    if (typeof node[key] !== 'string') continue;
    const rewritten = rewriteRef(node[key] as string, depth, scope, key === 'path' ? climbPath : climb);
    if (rewritten !== null) out[key] = rewritten;
  }
  for (const key of ['condition', 'filter'] as const) {
    if (node[key] !== undefined) out[key] = rewriteNode(node[key] as Condition, depth + 1, scope);
  }
  return out as Condition;
};

const relativeTo = (path: string, enclosing: string | undefined): string | null =>
  enclosing !== undefined && path.startsWith(`${enclosing}.`) ? path.slice(enclosing.length + 1) : null;

/**
 * The array rule a loop-bound rule has always been: one `any` per enclosing `{{#each}}`, the
 * innermost body as its condition, binding leaves element-relative and root leaves climbing with
 * `$$`. A leaf that reads a loop index, the element itself, or another lens's root has no shape the
 * lens can judge, and comes back as an issue — never as a rule to evaluate raw. A loop over the
 * opaque `data` bag has no lens to fold and comes back as written.
 */
/** Whether the collection a loop iterates sits in a lens: `data` is opaque by construction, and a lens says so for its slots. */
export const iteratesLens = (bindings: BindingChain | undefined, lens?: EmailLens): boolean => {
  const first = bindings && loopFrames(bindings)[0];
  if (!first) return false;
  const root = splitRoot(first.path).root;
  if (!lens) return root !== 'data';
  const slot = slotOf(lens, root);
  return slot !== undefined && slot !== OPAQUE_SLOT;
};

export const scopedRule = (
  rule: Condition,
  bindings: BindingChain | undefined,
  { lens, indices }: ScopedRuleOptions = {},
): ScopedRule => {
  if (!bindings?.size || !iteratesLens(bindings, lens)) return { rule };
  const frames = loopFrames(bindings);
  const root = frames.length ? splitRoot(frames[0]!.path).root : undefined;
  const scope: Scope = { frames, bindings, root, indices };
  try {
    let out = rewriteNode(rule, 0, scope);
    for (let index = frames.length - 1; index >= 0; index -= 1) {
      const frame = frames[index]!;
      const relative = relativeTo(frame.path, frames[index - 1]?.path);
      if (index > 0 && relative === null && splitRoot(frame.path).root !== root) {
        throw new Unsupported(
          `{{#each ${frame.path}}} iterates the ${splitRoot(frame.path).root} lens inside a loop over ${root}; nested loops must stay within one lens`,
        );
      }
      const field = index === 0 ? frame.path : (relative ?? climb(index, splitRoot(frame.path).rest));
      out = { field, arrayOperator: 'any', condition: out } as Condition;
    }
    return { rule: out };
  } catch (error) {
    if (error instanceof Unsupported) return { issue: error.message };
    throw error;
  }
};

const setAt = (target: unknown, path: string, value: unknown): unknown => {
  const { root: head, rest } = splitRoot(path);
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
