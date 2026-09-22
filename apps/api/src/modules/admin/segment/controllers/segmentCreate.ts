/**
 * @atlas
 * @kind controller
 * @partOf feature:segment, superadmin
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import { emitAppEvent } from '#/appEvents/emit';
import { makeController } from '#/lib/utils/makeController';
import { segmentCreateRoute } from '#/modules/admin/segment/routes/segmentCreate';
import { withSegmentRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';

export const segmentCreateController = makeController(segmentCreateRoute, async (c, respond) => {
  const db = c.get('db');
  const body = c.req.valid('json');

  const segment = await db.segment.create({
    data: { ...body, ownerModel: 'platform' } as Prisma.SegmentUncheckedCreateInput,
  });

  await emitAppEvent('segment.created', { segment });

  return respond.created(await withSegmentRuleIssues(segment));
});
