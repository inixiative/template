/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */

import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { meEstimateReachSegmentRoute } from '#/modules/me/routes/meEstimateReachSegment';
import { estimateSegmentReach } from '#/modules/segment/services/estimateSegmentReach';

export const meEstimateReachSegmentController = makeController(
  meEstimateReachSegmentRoute,
  async (c, respond) => {
    const user = actingUser(c)!;
    const { conditions } = c.req.valid('json');
    return respond.ok({ count: await estimateSegmentReach('User', user.id, conditions) });
  },
);
