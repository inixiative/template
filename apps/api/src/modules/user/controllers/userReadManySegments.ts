/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeSegmentRuleReferences } from '#/modules/segment/queries/segmentIncludes';
import { attachRuleHealthToSegments } from '#/modules/segment/services/attachRuleHealthToSegments';
import { userReadManySegmentsRoute } from '#/modules/user/routes/userReadManySegments';

export const userReadManySegmentsController = makeController(
  userReadManySegmentsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const user = getResource<'user'>(c);

    const { data, pagination } = await paginate(c, db.segment, {
      where: { ownerModel: 'User', userId: user.id },
      include: includeSegmentRuleReferences,
    });

    return respond.ok(await attachRuleHealthToSegments(data), { pagination });
  },
);
