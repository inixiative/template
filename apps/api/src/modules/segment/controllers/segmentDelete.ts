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
  await db.segment.update({ where: { id: segment.id }, data: { deletedAt: new Date() } });
  return respond.noContent();
});
