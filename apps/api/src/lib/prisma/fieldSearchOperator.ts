/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import { dialect } from '@template/db/lens';
import type { FieldDef } from '#/lib/prisma/fieldMetadata';

// Prisma has no universal substring op: String → contains, String[] → has,
// Json → string_contains; anything else is not text-searchable → undefined.
export const fieldSearchOperator = (field: FieldDef, term: string): Record<string, unknown> | undefined => {
  if (field.kind !== 'scalar') return undefined;
  if (field.type === 'String') {
    if (field.isList) return dialect.supportsScalarListSearch ? { has: term } : undefined;
    return dialect.stringMode ? { contains: term, mode: dialect.stringMode } : { contains: term };
  }
  if (field.type === 'Json') return { string_contains: term };
  return undefined;
};
