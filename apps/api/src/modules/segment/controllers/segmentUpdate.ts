/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import type { Prisma } from '@template/db';
import { emitAppEvent } from '#/appEvents/emit';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { segmentUpdateRoute } from '#/modules/segment/routes/segmentUpdate';
import { withSegmentRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';
import { assertNotInlineSegment } from '#/modules/segment/validations/assertNotInlineSegment';

export const segmentUpdateController = makeController(segmentUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const segment = getResource<'segment'>(c);
  assertNotInlineSegment(segment);
  const body = c.req.valid('json');

  const updated = await db.segment.update({
    where: { id: segment.id },
    data: body as Prisma.SegmentUncheckedUpdateInput,
  });

  await emitAppEvent('segment.updated', { segment: updated, previous: segment });

  return respond.ok(await withSegmentRuleIssues(updated));
});
