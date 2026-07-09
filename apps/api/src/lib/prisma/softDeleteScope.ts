/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { lookupField } from '#/lib/prisma/fieldMetadata';

export const hasSoftDelete = (model: string): boolean => lookupField(model, 'deletedAt') !== undefined;

const BOOLEAN_KEYS = new Set(['AND', 'OR', 'NOT']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Explicit `deletedAt` at THIS node wins over the auto-injected live scope. Key
// presence counts even with an `undefined` value — `deletedAt: undefined` is the
// deliberate "no filter" shape (the admin tri-state `all` branch). Only boolean
// combinators recurse: a `deletedAt` under a relation key belongs to that
// relation's node, not this one.
export const mentionsDeletedAt = (where: unknown): boolean => {
  if (!isPlainObject(where)) return false;
  return Object.entries(where).some(([key, value]) => {
    if (key === 'deletedAt') return true;
    if (!BOOLEAN_KEYS.has(key)) return false;
    return (Array.isArray(value) ? value : [value]).some(mentionsDeletedAt);
  });
};

// Fold `deletedAt: null` onto every to-many relation level of a Prisma
// include/select tree (to-one includes cannot carry a `where`). Explicit caller
// `deletedAt` at a level wins; non-relation entries (`_count`, scalar selects)
// pass through untouched.
export const scopeSoftDeleteInclude = (model: string, tree: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(tree)) {
    const field = lookupField(model, name);
    if (!value || field?.kind !== 'object') {
      out[name] = value;
      continue;
    }
    const entry: Record<string, unknown> = value === true ? {} : { ...(value as Record<string, unknown>) };
    for (const key of ['include', 'select'] as const) {
      if (isPlainObject(entry[key])) entry[key] = scopeSoftDeleteInclude(field.type, entry[key]);
    }
    if (field.isList && hasSoftDelete(field.type) && !mentionsDeletedAt(entry.where)) {
      entry.where = { ...(isPlainObject(entry.where) ? entry.where : {}), deletedAt: null };
    }
    out[name] = value === true && Object.keys(entry).length === 0 ? true : entry;
  }
  return out;
};
