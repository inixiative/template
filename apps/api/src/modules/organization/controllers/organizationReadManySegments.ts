/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManySegmentsRoute } from '#/modules/organization/routes/organizationReadManySegments';
import { withSegmentsRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';

export const organizationReadManySegmentsController = makeController(
  organizationReadManySegmentsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource<'organization'>(c);

    const { data, pagination } = await paginate(c, db.segment, {
      where: { ownerModel: 'Organization', organizationId: organization.id },
    });

    return respond.ok(await withSegmentsRuleIssues(data, db), { pagination });
  },
);
