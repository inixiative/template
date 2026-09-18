/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:shared
 */
import { type SourceValues, sourceValuesFromQueryRows } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { RuntimeDelegate } from '@template/db/utils/delegates';
import { type ModelName, toAccessor } from '@template/db/utils/modelNames';
import { type EmailLens, emailSourceQueries } from '@template/email/rules';

export const PICKED_SOURCE_MODELS: ReadonlySet<string> = new Set(['Tag', 'Segment']);

export const emailSourceValues = async (lens: EmailLens): Promise<SourceValues[]> => {
  const values: SourceValues[] = [];
  for (const query of emailSourceQueries(lens)) {
    if (!PICKED_SOURCE_MODELS.has(query.model) || query.prisma.steps) continue;
    const delegate = db[toAccessor(query.model as ModelName)] as unknown as RuntimeDelegate;
    const rows = (await delegate.findMany({
      where: query.prisma.where,
      select: query.prisma.select,
      ...(query.prisma.distinct ? { distinct: query.prisma.distinct } : {}),
    })) as Record<string, unknown>[];
    values.push(sourceValuesFromQueryRows(query, rows));
  }
  return values;
};
