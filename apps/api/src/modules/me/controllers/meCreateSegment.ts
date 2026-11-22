/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import type { Prisma } from '@template/db';
import { emitAppEvent } from '#/appEvents/emit';
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { meCreateSegmentRoute } from '#/modules/me/routes/meCreateSegment';
import { attachRuleHealthToSegment } from '#/modules/segment/services/attachRuleHealthToSegments';

export const meCreateSegmentController = makeController(
  meCreateSegmentRoute,
  async (c, respond) => {
    const user = actingUser(c)!;
    const db = c.get('db');
    const body = c.req.valid('json');

    const segment = await db.segment.create({
      data: {
        ...body,
        ownerModel: 'User',
        userId: user.id,
      } as Prisma.SegmentUncheckedCreateInput,
    });

    await emitAppEvent('segment.created', { segment });

    return respond.created(await attachRuleHealthToSegment(segment));
  },
);
