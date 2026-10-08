/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { SourcePrismaQuery, SourceQuery } from '@inixiative/json-rules';

export const sourcePrismaQuery = (query: SourceQuery): SourcePrismaQuery => {
  if (!query.prisma)
    throw new Error(
      `Source ${query.model}.${query.field} reads across a bridge and has no database query; materialize it from rows that carry the far side`,
    );
  return query.prisma;
};
