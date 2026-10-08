/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import { executePrismaPlan, type SourceQuery } from '@inixiative/json-rules';
import { db } from '@template/db/client';
import { sourcePrismaQuery } from '@template/db/utils/sourcePrismaQuery';

/** A source query's where, its count / aggregate steps resolved to the id sets they stand for. */
export const sourceQueryWhere = async (query: SourceQuery): Promise<Record<string, unknown>> => {
  const prisma = sourcePrismaQuery(query);
  return prisma.steps ? executePrismaPlan({ steps: prisma.steps }, db as never) : prisma.where;
};
