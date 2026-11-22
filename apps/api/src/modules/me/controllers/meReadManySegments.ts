/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */

import { actingUser } from '#/lib/context/actingUser';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManySegmentsRoute } from '#/modules/me/routes/meReadManySegments';
import { includeSegmentRuleReferences } from '#/modules/segment/queries/segmentIncludes';
import { attachRuleHealthToSegments } from '#/modules/segment/services/attachRuleHealthToSegments';

export const meReadManySegmentsController = makeController(
  meReadManySegmentsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const user = actingUser(c)!;

    const { data, pagination } = await paginate(c, db.segment, {
      where: { ownerModel: 'User', userId: user.id },
      include: includeSegmentRuleReferences,
    });

    return respond.ok(await attachRuleHealthToSegments(data), { pagination });
  },
);
