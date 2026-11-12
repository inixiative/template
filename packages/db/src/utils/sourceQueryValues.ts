/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  andWhere,
  executePrismaPlan,
  type Lens,
  type LensNarrowing,
  materializeSourceQuery,
  type SourceQuery,
  type SourceValues,
} from '@inixiative/json-rules';
import { db } from '@template/db/client';

type SourceRow = Record<string, unknown>;

export type SourceQueryScope = {
  lens: Lens | LensNarrowing;
  farSide?: (query: SourceQuery, candidates: SourceRow[]) => Promise<SourceRow[]>;
  among?: unknown[];
};

export const compiledSourceWhere = async (query: SourceQuery): Promise<Record<string, unknown>> =>
  query.prisma.steps
    ? executePrismaPlan({ steps: query.prisma.steps }, db as never)
    : query.prisma.where;

/** The source's options; with `among`, only those of these values, read in one bounded query. */
export const sourceQueryValues = async (
  query: SourceQuery,
  { lens, farSide, among }: SourceQueryScope,
): Promise<SourceValues> => {
  const { select, distinct } = query.prisma;
  const where = await compiledSourceWhere(query);
  const candidates = (await db.delegate(query.model).findMany({
    where: among ? andWhere([where, { [query.field]: { in: among } }]) : where,
    select,
    ...(distinct ? { distinct } : {}),
  })) as SourceRow[];
  const rows =
    query.recheck !== undefined && farSide ? await farSide(query, candidates) : candidates;
  return materializeSourceQuery(query, rows, { lens });
};
