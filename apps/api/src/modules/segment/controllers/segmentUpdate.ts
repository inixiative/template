/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { segmentUpdateRoute } from '#/modules/segment/routes/segmentUpdate';

export const segmentUpdateController = makeController(segmentUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const segment = getResource<'segment'>(c);
  const body = c.req.valid('json');

  const updated = await db.segment.update({
    where: { id: segment.id },
    data: body as Prisma.SegmentUncheckedUpdateInput,
  });

  return respond.ok(updated);
});
