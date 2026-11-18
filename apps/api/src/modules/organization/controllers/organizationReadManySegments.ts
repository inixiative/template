/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManySegmentsRoute } from '#/modules/organization/routes/organizationReadManySegments';
import { includeSegmentRuleReferences } from '#/modules/segment/queries/segmentIncludes';
import { attachRuleHealthToSegments } from '#/modules/segment/services/attachRuleHealthToSegments';

export const organizationReadManySegmentsController = makeController(
  organizationReadManySegmentsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = contextResource<'organization'>(c);

    const { data, pagination } = await paginate(c, db.segment, {
      where: { ownerModel: 'Organization', organizationId: organization.id },
      include: includeSegmentRuleReferences,
    });

    return respond.ok(await attachRuleHealthToSegments(data), { pagination });
  },
);
