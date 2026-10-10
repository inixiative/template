/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { FieldDef } from '@template/db';
import { dialect } from '@template/db/lens';
import { escapeLikePattern } from '#/lib/prisma/escapeLikePattern';

// Prisma has no universal substring op: String → contains, String[] → has,
// Json → string_contains; anything else is not text-searchable → undefined.
export const fieldSearchOperator = (
  field: FieldDef,
  term: string,
): Record<string, unknown> | undefined => {
  if (field.kind !== 'scalar') return undefined;
  if (field.type === 'String') {
    if (field.isList) return dialect.supportsScalarListSearch ? { has: term } : undefined;
    const contains = escapeLikePattern(term);
    return dialect.stringMode ? { contains, mode: dialect.stringMode } : { contains };
  }
  if (field.type === 'Json') return { string_contains: escapeLikePattern(term) };
  return undefined;
};
