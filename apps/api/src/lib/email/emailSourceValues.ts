/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:shared
 */
import { type SourceQuery, type SourceValues, sourceValuesFromQueryRows } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { RuntimeDelegate } from '@template/db/utils/delegates';
import { type ModelName, toAccessor } from '@template/db/utils/modelNames';
import { type EmailLens, emailSourceQueries } from '@template/email/rules';

const sourceValuesOf = async (query: SourceQuery): Promise<SourceValues> => {
  const delegate = db[toAccessor(query.model as ModelName)] as unknown as RuntimeDelegate;
  const rows = (await delegate.findMany({
    where: query.prisma.where,
    select: query.prisma.select,
    ...(query.prisma.distinct ? { distinct: query.prisma.distinct } : {}),
  })) as Record<string, unknown>[];
  return sourceValuesFromQueryRows(query, rows);
};

export const emailSourceValues = (lens: EmailLens): Promise<SourceValues[]> =>
  Promise.all(
    emailSourceQueries(lens)
      .filter((query) => !query.prisma.steps)
      .map(sourceValuesOf),
  );
