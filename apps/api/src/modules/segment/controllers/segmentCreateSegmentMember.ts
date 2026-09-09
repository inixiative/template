/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import { SegmentMemberSource } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { segmentCreateSegmentMemberRoute } from '#/modules/segment/routes/segmentCreateSegmentMember';

export const segmentCreateSegmentMemberController = makeController(
  segmentCreateSegmentMemberRoute,
  async (c, respond) => {
    const db = c.get('db');
    const segment = getResource<'segment'>(c);
    const body = c.req.valid('json');

    const member = await db.segmentMember.upsert({
      where: { segmentId_customerRefId: { segmentId: segment.id, customerRefId: body.customerRefId } },
      create: { segmentId: segment.id, customerRefId: body.customerRefId, source: SegmentMemberSource.manual },
      update: { source: SegmentMemberSource.manual },
    });

    return respond.created(member);
  },
);
