/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import type { Prisma } from '@template/db';
import { makeController } from '#/lib/utils/makeController';
import { meCreateSegmentRoute } from '#/modules/me/routes/meCreateSegment';
import { withSegmentRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';

export const meCreateSegmentController = makeController(meCreateSegmentRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const body = c.req.valid('json');

  const segment = await db.segment.create({
    data: {
      ...body,
      ownerModel: 'User',
      userId: user.id,
    } as Prisma.SegmentUncheckedCreateInput,
  });

  return respond.created(await withSegmentRuleIssues(segment, db));
});
