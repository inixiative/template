/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { castArray } from 'lodash-es';
import { hasDeletedAt, lookupField } from '#/lib/prisma/fieldMetadata';
import { type NodeScope, walkWhere } from '#/lib/prisma/whereWalker';

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
const liveScope = (model: string): Record<string, unknown> | undefined =>
  hasDeletedAt(model) ? { deletedAt: null } : undefined;

const liveAt: NodeScope = ({ model }, node) => {
  const live = liveScope(model);
  return live && !mentionsDeletedAt(node) ? [live] : [];
};

export const liveWhere = (model: string, where: Record<string, unknown>): Record<string, unknown> =>
  walkWhere(model, where, liveAt);

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

// Parked (Aron, 2026-07-11): a full db-read extension (auto-scope every query
// at the client layer) was considered and parked: superadmin awareness and
// revive/tri-state flows conflict with an always-on rewrite.
