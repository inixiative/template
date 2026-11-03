/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:auth
 */
import { includeTargetEntitlements, type Prisma, withEntitlementEntries } from '@template/db';

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
        include: typeof includeTargetEntitlements & {
          organization: true;
          organizationUser: true;
          space: true;
          spaceUser: true;
        };
        omit: { keyHash: true };
      }>
    >(c, db.token, {
      where: {
        userId: user.id,
        ownerModel: { in: ['User', 'OrganizationUser', 'SpaceUser'] },
      },
      include: {
        ...includeTargetEntitlements,
        organization: true,
        organizationUser: true,
        space: true,
        spaceUser: true,
      },
      omit: { keyHash: true },
    });

    return respond.ok(
      data.map((row) => withEntitlementEntries(row)),
      { pagination },
    );
  },
);
