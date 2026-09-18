/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManySegmentMembershipsRoute } from '#/modules/organization/routes/organizationReadManySegmentMemberships';
import { includeSegmentForCustomer } from '#/modules/segment/queries/segmentIncludes';

export const organizationReadManySegmentMembershipsController = makeController(
  organizationReadManySegmentMembershipsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource<'organization'>(c);

    const { data, pagination } = await paginate(c, db.segmentMember, {
      where: { customerRef: { customerOrganizationId: organization.id }, segment: { deletedAt: null } },
      include: includeSegmentForCustomer,
    });

    return respond.ok(data, { pagination });
  },
);
