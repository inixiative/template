/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { estimateSegmentReach } from '#/modules/segment/services/estimateSegmentReach';
import { spaceEstimateReachSegmentRoute } from '#/modules/space/routes/spaceEstimateReachSegment';

export const spaceEstimateReachSegmentController = makeController(
  spaceEstimateReachSegmentRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const { conditions } = c.req.valid('json');
    return respond.ok({ count: await estimateSegmentReach('Space', space.id, conditions) });
  },
);
