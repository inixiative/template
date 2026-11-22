/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import type { Prisma } from '@template/db';
import { emitAppEvent } from '#/appEvents/emit';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateSegmentRoute } from '#/modules/organization/routes/organizationCreateSegment';
import { attachRuleHealthToSegment } from '#/modules/segment/services/attachRuleHealthToSegments';

export const organizationCreateSegmentController = makeController(
  organizationCreateSegmentRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = contextResource<'organization'>(c);
    const body = c.req.valid('json');

    const segment = await db.segment.create({
      data: {
        ...body,
        ownerModel: 'Organization',
        organizationId: organization.id,
      } as Prisma.SegmentUncheckedCreateInput,
    });

    await emitAppEvent('segment.created', { segment });

    return respond.created(await attachRuleHealthToSegment(segment));
  },
);
