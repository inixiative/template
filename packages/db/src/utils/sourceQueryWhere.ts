/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { SourceQuery } from '@inixiative/json-rules';
import {
  compiledSourceWhere,
  type SourceQueryScope,
  sourceQueryValues,
} from '@template/db/utils/sourceQueryValues';

/** The rows a source admits as a where; a bridged query's candidates are re-checked first and pinned by value. */
export const sourceQueryWhere = async (
  query: SourceQuery,
  scope: SourceQueryScope,
): Promise<Record<string, unknown>> => {
  const where = await compiledSourceWhere(query);
  if (query.recheck === undefined) return where;
  const { options } = await sourceQueryValues(query, scope);
  return { AND: [where, { [query.field]: { in: options.map((option) => option.value) } }] };
};
