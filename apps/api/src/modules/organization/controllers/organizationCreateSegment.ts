/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateSegmentRoute } from '#/modules/organization/routes/organizationCreateSegment';
import { withSegmentRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';

export const organizationCreateSegmentController = makeController(
  organizationCreateSegmentRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource<'organization'>(c);
    const body = c.req.valid('json');

    const segment = await db.segment.create({
      data: {
        ...body,
        ownerModel: 'Organization',
        organizationId: organization.id,
      } as Prisma.SegmentUncheckedCreateInput,
    });

    return respond.created(await withSegmentRuleIssues(segment, db));
  },
);
