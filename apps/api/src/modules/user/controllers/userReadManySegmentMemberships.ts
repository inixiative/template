/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeSegmentForCustomer } from '#/modules/segment/queries/segmentIncludes';
import { userReadManySegmentMembershipsRoute } from '#/modules/user/routes/userReadManySegmentMemberships';

export const userReadManySegmentMembershipsController = makeController(
  userReadManySegmentMembershipsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const user = getResource<'user'>(c);

    const { data, pagination } = await paginate(c, db.segmentMember, {
      where: { customerRef: { customerUserId: user.id }, segment: { deletedAt: null } },
      include: includeSegmentForCustomer,
    });

    return respond.ok(data, { pagination });
  },
);
