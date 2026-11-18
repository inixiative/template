/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeCustomer } from '#/modules/customerRef/queries/customerRefIncludes';
import { segmentReadManySegmentMembersRoute } from '#/modules/segment/routes/segmentReadManySegmentMembers';

export const segmentReadManySegmentMembersController = makeController(
  segmentReadManySegmentMembersRoute,
  async (c, respond) => {
    const db = c.get('db');
    const segment = contextResource<'segment'>(c);

    const { data, pagination } = await paginate(c, db.segmentMember, {
      where: { segmentId: segment.id },
      include: { customerRef: { include: includeCustomer } },
    });

    return respond.ok(data, { pagination });
  },
);
