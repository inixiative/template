/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import type { Prisma } from '@template/db';
import { emitAppEvent } from '#/appEvents/emit';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { attachRuleHealthToSegment } from '#/modules/segment/services/attachRuleHealthToSegments';
import { spaceCreateSegmentRoute } from '#/modules/space/routes/spaceCreateSegment';

export const spaceCreateSegmentController = makeController(
  spaceCreateSegmentRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);
    const body = c.req.valid('json');

    const segment = await db.segment.create({
      data: {
        ...body,
        ownerModel: 'Space',
        spaceId: space.id,
      } as Prisma.SegmentUncheckedCreateInput,
    });

    await emitAppEvent('segment.created', { segment });

    return respond.created(await attachRuleHealthToSegment(segment));
  },
);
