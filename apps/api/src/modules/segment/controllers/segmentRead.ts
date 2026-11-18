/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { segmentReadRoute } from '#/modules/segment/routes/segmentRead';
import { attachRuleHealthToSegment } from '#/modules/segment/services/attachRuleHealthToSegments';

export const segmentReadController = makeController(segmentReadRoute, async (c, respond) => {
  const segment = contextResource<'segment'>(c);
  return respond.ok(await attachRuleHealthToSegment(segment));
});
