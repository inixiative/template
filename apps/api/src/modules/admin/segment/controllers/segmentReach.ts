/**
 * @atlas
 * @kind controller
 * @partOf feature:segment, superadmin
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { segmentReachRoute } from '#/modules/admin/segment/routes/segmentReach';
import { estimateSegmentReach } from '#/modules/segment/services/estimateSegmentReach';

export const segmentReachController = makeController(segmentReachRoute, async (c, respond) => {
  const { conditions } = c.req.valid('json');
  return respond.ok({ count: await estimateSegmentReach('platform', 'platform', conditions) });
});
