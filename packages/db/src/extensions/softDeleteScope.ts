/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { fieldAtPath, modelOf } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import { hasDeletedAt } from '@template/db/utils/fieldMetadata';
import { type NodeScope, walkWhere } from '@template/db/utils/whereWalker';
import { castArray } from 'lodash-es';

const BOOLEAN_KEYS = new Set(['AND', 'OR', 'NOT']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Key presence counts even with an `undefined` value — `deletedAt: undefined`
// is the deliberate opt-out (the admin tri-state `all` branch).
const mentionsDeletedAt = (where: unknown): boolean => {
  if (!isPlainObject(where)) return false;
  return Object.entries(where).some(([key, value]) => {
    if (key === 'deletedAt') return true;
    if (!BOOLEAN_KEYS.has(key)) return false;
    return castArray(value).some(mentionsDeletedAt);
  });
};

// A model without its own column has no query-time scope: the soft-delete
// cascade hook keeps column-bearing descendants consistent at write time.
const notDeletedScope = (model: string): Record<string, unknown> | undefined =>
  hasDeletedAt(model) ? { deletedAt: null } : undefined;

const notDeletedAtNode: NodeScope = ({ model }, node) => {
  const notDeleted = notDeletedScope(model);
  return notDeleted && !mentionsDeletedAt(node) ? [notDeleted] : [];
};

export const notDeletedWhere = (
  model: string,
  where: Record<string, unknown>,
): Record<string, unknown> => walkWhere(model, where, notDeletedAtNode);

const listRelationNames = (model: string): Record<string, true> =>
  Object.fromEntries(
    Object.entries(modelOf(prismaMap, model)?.fields ?? {})
      .filter(([, field]) => field.kind === 'object' && field.isList)
      .map(([name]) => [name, true as const]),
  );

const notDeletedCount = (model: string, count: unknown): unknown => {
  const select =
    count === true
      ? listRelationNames(model)
      : isPlainObject(count) && isPlainObject(count.select)
        ? count.select
        : undefined;
  if (!select) return count;
  const scoped: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(select)) {
    const field = fieldAtPath(prismaMap, model, name);
    const notDeleted = field ? notDeletedScope(field.type) : undefined;
    if (!value || !field || !notDeleted) {
      scoped[name] = value;
      continue;
    }
    const entry: Record<string, unknown> =
      value === true ? {} : { ...(value as Record<string, unknown>) };
    entry.where = isPlainObject(entry.where)
      ? notDeletedWhere(field.type, entry.where)
      : notDeleted;
    scoped[name] = entry;
  }
  return { ...(isPlainObject(count) ? count : {}), select: scoped };
};

export const notDeletedIncludes = (
  model: string,
  tree: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(tree)) {
    if (name === '_count') {
      out[name] = notDeletedCount(model, value);
      continue;
    }
    const field = fieldAtPath(prismaMap, model, name);
    if (!value || field?.kind !== 'object') {
      out[name] = value;
      continue;
    }
    const entry: Record<string, unknown> =
      value === true ? {} : { ...(value as Record<string, unknown>) };
    for (const key of ['include', 'select'] as const) {
      if (isPlainObject(entry[key])) entry[key] = notDeletedIncludes(field.type, entry[key]);
    }
    if (field.isList) {
      if (isPlainObject(entry.where)) {
        entry.where = notDeletedWhere(field.type, entry.where);
      } else {
        const notDeleted = notDeletedScope(field.type);
        if (notDeleted) entry.where = notDeleted;
      }
    }
    out[name] = value === true && Object.keys(entry).length === 0 ? true : entry;
  }
  return out;
};
