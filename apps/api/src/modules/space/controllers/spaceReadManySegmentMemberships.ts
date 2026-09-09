/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeSegmentForCustomer } from '#/modules/segment/queries/segmentIncludes';
import { spaceReadManySegmentMembershipsRoute } from '#/modules/space/routes/spaceReadManySegmentMemberships';

export const spaceReadManySegmentMembershipsController = makeController(
  spaceReadManySegmentMembershipsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);

    const { data, pagination } = await paginate(c, db.segmentMember, {
      where: { customerRef: { customerSpaceId: space.id }, segment: { deletedAt: null } },
      include: includeSegmentForCustomer,
    });

    return respond.ok(data, { pagination });
  },
);
