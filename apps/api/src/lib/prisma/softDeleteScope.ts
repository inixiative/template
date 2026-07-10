/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { isRelationOperator } from '@template/shared/bracketQuery';
import { type FieldDef, hasDeletedAt, lookupField } from '#/lib/prisma/fieldMetadata';

const BOOLEAN_KEYS = new Set(['AND', 'OR', 'NOT']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Key presence counts even with an `undefined` value — `deletedAt: undefined`
// is the deliberate opt-out (the admin tri-state `all` branch).
export const mentionsDeletedAt = (where: unknown): boolean => {
  if (!isPlainObject(where)) return false;
  return Object.entries(where).some(([key, value]) => {
    if (key === 'deletedAt') return true;
    if (!BOOLEAN_KEYS.has(key)) return false;
    return (Array.isArray(value) ? value : [value]).some(mentionsDeletedAt);
  });
};

// A model without its own column has no query-time scope: the soft-delete
// cascade hook keeps column-bearing descendants consistent at write time.
export const liveScope = (model: string): Record<string, unknown> | undefined =>
  hasDeletedAt(model) ? { deletedAt: null } : undefined;

const appendLive = (model: string, node: Record<string, unknown>): Record<string, unknown> => {
  const live = liveScope(model);
  if (!live || mentionsDeletedAt(node)) return node;
  return { ...node, ...live };
};

export const liveWhere = (model: string, where: Record<string, unknown>): Record<string, unknown> =>
  appendLive(model, walk(model, where));

const walk = (model: string, node: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (BOOLEAN_KEYS.has(key)) {
      out[key] = Array.isArray(value)
        ? value.map((v) => (isPlainObject(v) ? walk(model, v) : v))
        : isPlainObject(value)
          ? walk(model, value)
          : value;
      continue;
    }
    const field = lookupField(model, key);
    out[key] = field?.kind === 'object' && isPlainObject(value) ? hop(field, value) : value;
  }
  return out;
};

// `every` gets scope by implication — a soft-deleted row must never fail the
// predicate. Bare `isNot` gets it as a fail-closed `is` sibling — folded
// inside, a soft-deleted row would pass the negation.
const hop = (field: FieldDef, value: Record<string, unknown>): Record<string, unknown> => {
  const target = field.type;
  if (!Object.keys(value).some(isRelationOperator)) {
    return field.isList ? value : liveWhere(target, value);
  }
  const out: Record<string, unknown> = {};
  for (const [op, opValue] of Object.entries(value)) {
    if (!isRelationOperator(op) || !isPlainObject(opValue)) {
      out[op] = opValue;
    } else if (op === 'isNot') {
      out[op] = walk(target, opValue);
    } else if (op === 'every') {
      const walked = walk(target, opValue);
      const live = liveScope(target);
      out[op] = live && !mentionsDeletedAt(walked) ? { OR: [{ NOT: live }, walked] } : walked;
    } else {
      out[op] = liveWhere(target, opValue);
    }
  }
  if (out.isNot !== undefined && out.is === undefined) {
    const live = liveScope(target);
    if (live) out.is = live;
  }
  return out;
};

export const liveIncludes = (model: string, tree: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(tree)) {
    const field = lookupField(model, name);
    if (!value || field?.kind !== 'object') {
      out[name] = value;
      continue;
    }
    const entry: Record<string, unknown> = value === true ? {} : { ...(value as Record<string, unknown>) };
    for (const key of ['include', 'select'] as const) {
      if (isPlainObject(entry[key])) entry[key] = liveIncludes(field.type, entry[key]);
    }
    if (field.isList) {
      if (isPlainObject(entry.where)) {
        entry.where = liveWhere(field.type, entry.where);
      } else {
        const live = liveScope(field.type);
        if (live) entry.where = live;
      }
    }
    out[name] = value === true && Object.keys(entry).length === 0 ? true : entry;
  }
  return out;
};
