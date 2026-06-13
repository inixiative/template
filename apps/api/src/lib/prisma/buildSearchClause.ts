/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import { dialect } from '#/lib/prisma/dialect';
import type { FieldDef } from '#/lib/prisma/fieldMetadata';

// The clause for one field under the broad global `search` term. Operator depends
// on the field kind (Prisma has no universal substring op):
//   String (scalar) → contains (+ mode where the provider supports it)
//   String[]        → has (exact element; only where the provider has scalar arrays)
//   Json            → string_contains
// Anything else is not text-searchable → undefined (skip).
export const buildSearchClause = (field: FieldDef, term: string): Record<string, unknown> | undefined => {
  if (field.kind !== 'scalar') return undefined;
  if (field.type === 'String') {
    if (field.isList) return dialect.supportsScalarListSearch ? { has: term } : undefined;
    return dialect.stringMode ? { contains: term, mode: dialect.stringMode } : { contains: term };
  }
  if (field.type === 'Json') return { string_contains: term };
  return undefined;
};
