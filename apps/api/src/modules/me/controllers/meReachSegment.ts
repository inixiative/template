/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */

import { me } from '#/lib/context/me';
import { makeController } from '#/lib/utils/makeController';
import { meReachSegmentRoute } from '#/modules/me/routes/meReachSegment';
import { estimateSegmentReach } from '#/modules/segment/services/estimateSegmentReach';

export const meReachSegmentController = makeController(meReachSegmentRoute, async (c, respond) => {
  const user = me(c)!;
  const { conditions } = c.req.valid('json');
  return respond.ok({ count: await estimateSegmentReach('User', user.id, conditions) });
});
