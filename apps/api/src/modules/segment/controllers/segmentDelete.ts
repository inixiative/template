/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { segmentDeleteRoute } from '#/modules/segment/routes/segmentDelete';

export const segmentDeleteController = makeController(segmentDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const segment = getResource<'segment'>(c);
  await db.segment.delete({ where: { id: segment.id } });
  return respond.noContent();
});
