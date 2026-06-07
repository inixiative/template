import type { FieldDef } from '#/lib/prisma/fieldMetadata';

// The clause for one field under the broad global `search` term. Operator depends
// on the field kind (Prisma has no universal substring op):
//   String (scalar) → contains (case-insensitive)
//   String[]        → has (exact element; Postgres-only — MySQL has no scalar arrays)
//   Json            → string_contains
// Anything else is not text-searchable → undefined (skip).
export const buildSearchClause = (field: FieldDef, term: string): Record<string, unknown> | undefined => {
  if (field.kind !== 'scalar') return undefined;
  if (field.type === 'String') return field.isList ? { has: term } : { contains: term, mode: 'insensitive' };
  if (field.type === 'Json') return { string_contains: term };
  return undefined;
};
