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
  toSourceQueries,
} from '@inixiative/json-rules';
import { db, sourcePrismaQuery, sourceQueryWhere } from '@template/db';
import type { ScopeRoot } from '@template/email/render/conditionParser';
import { type EmailLens, emailSlotLenses } from '@template/email/rules';

const sourceValuesOf = async (query: SourceQuery): Promise<SourceValues> => {
  const { select, distinct } = sourcePrismaQuery(query);
  const rows = (await db.delegate(query.model).findMany({
    where: await sourceQueryWhere(query),
    select,
    ...(distinct ? { distinct } : {}),
  })) as Record<string, unknown>[];
  return materializeSourceQuery(query, rows);
};

export const emailSourceValues = (lens: EmailLens): Promise<[ScopeRoot, SourceValues][]> =>
  Promise.all(
    emailSlotLenses(lens).flatMap(([root, slot]) =>
      toSourceQueries(slot).map(
        async (query): Promise<[ScopeRoot, SourceValues]> => [root, await sourceValuesOf(query)],
      ),
    ),
  );
