/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { includeSegmentForCustomer } from '#/modules/segment/queries/segmentIncludes';
import { userReadManySegmentMembershipsRoute } from '#/modules/user/routes/userReadManySegmentMemberships';

export const userReadManySegmentMembershipsController = makeController(
  userReadManySegmentMembershipsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const user = contextResource<'user'>(c);

    const { data, pagination } = await paginate(c, db.segmentMember, {
      where: { customerRelationship: { customerUserId: user.id }, segment: { deletedAt: null } },
      include: includeSegmentForCustomer,
    });

    return respond.ok(data, { pagination });
  },
);
