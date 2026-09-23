/**
 * @atlas
 * @kind controller
 * @partOf feature:segment, superadmin
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { segmentReadManyRoute } from '#/modules/admin/segment/routes/segmentReadMany';
import { includeSegmentRuleReferences } from '#/modules/segment/queries/segmentIncludes';
import { withSegmentsRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';

export const segmentReadManyController = makeController(segmentReadManyRoute, async (c, respond) => {
  const db = c.get('db');

  const { data, pagination } = await paginate(c, db.segment, {
    where: { featureFlagInternal: false },
    include: includeSegmentRuleReferences,
  });

  return respond.ok(await withSegmentsRuleIssues(data), { pagination });
});
