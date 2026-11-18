/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */

import { map } from 'lodash-es';
import { emitAppEvent } from '#/appEvents/emit';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { segmentDeleteRoute } from '#/modules/segment/routes/segmentDelete';

export const segmentDeleteController = makeController(segmentDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const segment = contextResource<'segment'>(c);
  const members = await db.segmentMember.findMany({ where: { segmentId: segment.id } });
  const deleted = await db.segment.update({
    where: { id: segment.id },
    data: { deletedAt: new Date() },
  });
  await emitAppEvent('segment.deleted', {
    segment: deleted,
    customerRelationshipIds: map(members, 'customerRelationshipId'),
  });
  return respond.noContent();
});
