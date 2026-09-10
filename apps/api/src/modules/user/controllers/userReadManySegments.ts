/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { withSegmentsRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';
import { userReadManySegmentsRoute } from '#/modules/user/routes/userReadManySegments';

export const userReadManySegmentsController = makeController(userReadManySegmentsRoute, async (c, respond) => {
  const db = c.get('db');
  const user = getResource<'user'>(c);

  const { data, pagination } = await paginate(c, db.segment, {
    where: { ownerModel: 'User', userId: user.id },
  });

  return respond.ok(await withSegmentsRuleIssues(data, db), { pagination });
});
