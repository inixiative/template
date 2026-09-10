/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { withSegmentRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';
import { spaceCreateSegmentRoute } from '#/modules/space/routes/spaceCreateSegment';

export const spaceCreateSegmentController = makeController(spaceCreateSegmentRoute, async (c, respond) => {
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

  return respond.created(await withSegmentRuleIssues(segment, db));
});
