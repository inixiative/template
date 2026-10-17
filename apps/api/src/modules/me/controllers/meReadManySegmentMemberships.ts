/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManySegmentMembershipsRoute } from '#/modules/me/routes/meReadManySegmentMemberships';
import { includeSegmentForCustomer } from '#/modules/segment/queries/segmentIncludes';

export const meReadManySegmentMembershipsController = makeController(
  meReadManySegmentMembershipsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const user = c.get('user')!;

    const { data, pagination } = await paginate(c, db.segmentMember, {
      where: { customerRef: { customerUserId: user.id }, segment: { deletedAt: null } },
      include: includeSegmentForCustomer,
    });

    return respond.ok(data, { pagination });
  },
);
