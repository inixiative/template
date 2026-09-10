/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManySegmentsRoute } from '#/modules/me/routes/meReadManySegments';
import { withSegmentsRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';

export const meReadManySegmentsController = makeController(meReadManySegmentsRoute, async (c, respond) => {
  const db = c.get('db');
  const user = c.get('user')!;

  const { data, pagination } = await paginate(c, db.segment, {
    where: { ownerModel: 'User', userId: user.id },
  });

  return respond.ok(await withSegmentsRuleIssues(data, db), { pagination });
});
