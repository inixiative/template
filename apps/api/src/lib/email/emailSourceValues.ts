/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:shared
 */
import {
  materializeSourceQuery,
  type SourceQuery,
  type SourceValues,
} from '@inixiative/json-rules';
import { db, sourceQueryWhere } from '@template/db';
import { type EmailLens, emailSourceQueries } from '@template/email/rules';

const sourceValuesOf = async (query: SourceQuery): Promise<SourceValues> => {
  const delegate = db.delegate(query.model);
  const rows = (await delegate.findMany({
    where: await sourceQueryWhere(query),
    select: query.prisma.select,
    ...(query.prisma.distinct ? { distinct: query.prisma.distinct } : {}),
  })) as Record<string, unknown>[];
  return materializeSourceQuery(query, rows);
};

export const emailSourceValues = (lens: EmailLens): Promise<SourceValues[]> =>
  Promise.all(emailSourceQueries(lens).map(sourceValuesOf));
