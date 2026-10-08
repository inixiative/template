/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
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
};

export const compiledSourceWhere = async (query: SourceQuery): Promise<Record<string, unknown>> =>
  query.prisma.steps
    ? executePrismaPlan({ steps: query.prisma.steps }, db as never)
    : query.prisma.where;

export const sourceQueryValues = async (
  query: SourceQuery,
  { lens, farSide }: SourceQueryScope,
  where: Record<string, unknown> = {},
): Promise<SourceValues> => {
  const { select, distinct } = query.prisma;
  const candidates = (await db.delegate(query.model).findMany({
    where: { AND: [await compiledSourceWhere(query), where] },
    select,
    ...(distinct ? { distinct } : {}),
  })) as SourceRow[];
  const rows =
    query.recheck !== undefined && farSide ? await farSide(query, candidates) : candidates;
  return materializeSourceQuery(query, rows, { lens });
};
