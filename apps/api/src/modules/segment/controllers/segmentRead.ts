/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { segmentReadRoute } from '#/modules/segment/routes/segmentRead';
import { withSegmentRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';

export const segmentReadController = makeController(segmentReadRoute, async (c, respond) => {
  const db = c.get('db');
  const segment = getResource<'segment'>(c);
  return respond.ok(await withSegmentRuleIssues(segment, db));
});
