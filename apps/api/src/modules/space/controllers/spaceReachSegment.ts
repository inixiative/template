/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { estimateSegmentReach } from '#/modules/segment/services/estimateSegmentReach';
import { spaceReachSegmentRoute } from '#/modules/space/routes/spaceReachSegment';

export const spaceReachSegmentController = makeController(spaceReachSegmentRoute, async (c, respond) => {
  const space = getResource<'space'>(c);
  const { conditions } = c.req.valid('json');
  return respond.ok({ count: await estimateSegmentReach('Space', space.id, conditions, c.get('db')) });
});
