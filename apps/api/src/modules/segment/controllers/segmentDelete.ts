/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */

import { map } from 'lodash-es';
import { emitAppEvent } from '#/appEvents/emit';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { segmentDeleteRoute } from '#/modules/segment/routes/segmentDelete';

export const segmentDeleteController = makeController(segmentDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const segment = getResource<'segment'>(c);
  const members = await db.segmentMember.findMany({ where: { segmentId: segment.id } });
  const deleted = await db.segment.update({ where: { id: segment.id }, data: { deletedAt: new Date() } });
  await emitAppEvent('segment.deleted', { segment: deleted, customerRefIds: map(members, 'customerRefId') });
  return respond.noContent();
});
