/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:auth
 */
import {
  type IncludeTargetEntitlements,
  includeTargetEntitlements,
  type Prisma,
} from '@template/db';

import { me } from '#/lib/context/me';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyTokensRoute } from '#/modules/me/routes/meReadManyTokens';

export const meReadManyTokensController = makeController(
  meReadManyTokensRoute,
  async (c, respond) => {
    const user = me(c)!;
    const db = c.get('db');

    const { data, pagination } = await paginate<
      typeof db.token,
      Prisma.TokenGetPayload<{
        include: IncludeTargetEntitlements & {
          organization: true;
          organizationUser: { include: IncludeTargetEntitlements };
          space: true;
          spaceUser: { include: IncludeTargetEntitlements };
        };
        omit: { keyHash: true };
      }>
    >(c, db.token, {
      where: {
        userId: user.id,
        ownerModel: { in: ['User', 'OrganizationUser', 'SpaceUser'] },
      },
      include: {
        ...includeTargetEntitlements('Token'),
        organization: true,
        organizationUser: { include: includeTargetEntitlements('OrganizationUser') },
        space: true,
        spaceUser: { include: includeTargetEntitlements('SpaceUser') },
      },
      omit: { keyHash: true },
    });

    return respond.ok(data, { pagination });
  },
);
