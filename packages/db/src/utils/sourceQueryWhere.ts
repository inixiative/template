/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import { executePrismaPlan, type SourceQuery } from '@inixiative/json-rules';
import { db } from '@template/db/client';

/** A source query's where, its count / aggregate steps resolved to the id sets they stand for. */
export const sourceQueryWhere = async (query: SourceQuery): Promise<Record<string, unknown>> =>
  query.prisma.steps
    ? executePrismaPlan({ steps: query.prisma.steps }, db as never)
    : query.prisma.where;
