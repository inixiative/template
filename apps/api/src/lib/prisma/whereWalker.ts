/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { isRelationOperator } from '@template/shared/bracketQuery';
import { type FieldDef, lookupField } from '#/lib/prisma/fieldMetadata';

const BOOLEAN_KEYS = new Set(['AND', 'OR', 'NOT']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type NodeContext = { model: string; path: string };
export type NodeScope = (ctx: NodeContext, node: Record<string, unknown>) => Record<string, unknown>[];

const merge = (node: Record<string, unknown>, clauses: Record<string, unknown>[]): Record<string, unknown> => {
  if (!clauses.length) return node;
  if (clauses.length === 1 && !Object.keys(clauses[0]).some((key) => key in node)) return { ...node, ...clauses[0] };
  return { AND: [node, ...clauses] };
};

const asOne = (clauses: Record<string, unknown>[]): Record<string, unknown> =>
  clauses.length === 1 ? clauses[0] : { AND: clauses };

// Walks a composed Prisma where, applying `scopeAt`'s clauses at the root and
// at every relation traversal. Boolean combinators stay on their model; each
// relation hop advances `path` (dotted field chain from the root, '' at root).
// `every` gets scope by implication — an out-of-scope row must never fail the
// predicate. Bare `isNot` gets scope as a fail-closed `is` sibling — folded
// inside, an out-of-scope row would pass the negation.
export const walkWhere = (model: string, where: Record<string, unknown>, scopeAt: NodeScope): Record<string, unknown> =>
  scopeNode({ model, path: '' }, where, scopeAt);

const scopeNode = (ctx: NodeContext, node: Record<string, unknown>, scopeAt: NodeScope): Record<string, unknown> => {
  const walked = walkEntries(ctx, node, scopeAt);
  return merge(walked, scopeAt(ctx, walked));
};

const walkEntries = (ctx: NodeContext, node: Record<string, unknown>, scopeAt: NodeScope): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (BOOLEAN_KEYS.has(key)) {
      out[key] = Array.isArray(value)
        ? value.map((v) => (isPlainObject(v) ? walkEntries(ctx, v, scopeAt) : v))
        : isPlainObject(value)
          ? walkEntries(ctx, value, scopeAt)
          : value;
      continue;
    }
    const field = lookupField(ctx.model, key);
    out[key] =
      field?.kind === 'object' && isPlainObject(value)
        ? hop({ model: field.type, path: ctx.path ? `${ctx.path}.${key}` : key }, field, value, scopeAt)
        : value;
  }
  return out;
};

const hop = (
  ctx: NodeContext,
  field: FieldDef,
  value: Record<string, unknown>,
  scopeAt: NodeScope,
): Record<string, unknown> => {
  if (!Object.keys(value).some(isRelationOperator)) {
    return field.isList ? value : scopeNode(ctx, value, scopeAt);
  }
  const out: Record<string, unknown> = {};
  for (const [op, opValue] of Object.entries(value)) {
    if (!isRelationOperator(op) || !isPlainObject(opValue)) {
      out[op] = opValue;
    } else if (op === 'isNot') {
      out[op] = walkEntries(ctx, opValue, scopeAt);
    } else if (op === 'every') {
      const walked = walkEntries(ctx, opValue, scopeAt);
      const clauses = scopeAt(ctx, walked);
      out[op] = clauses.length ? { OR: [{ NOT: asOne(clauses) }, walked] } : walked;
    } else {
      out[op] = scopeNode(ctx, opValue, scopeAt);
    }
  }
  if (out.isNot !== undefined && out.is === undefined) {
    const clauses = scopeAt(ctx, {});
    if (clauses.length) out.is = asOne(clauses);
  }
  return out;
};
