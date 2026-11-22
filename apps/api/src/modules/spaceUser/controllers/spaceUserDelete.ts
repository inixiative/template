/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { db } from '@template/db';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserDeleteRoute } from '#/modules/spaceUser/routes/spaceUserDelete';

export const spaceUserDeleteController = makeController(
  spaceUserDeleteRoute,
  async (c, respond) => {
    const spaceUser = contextResource<'spaceUser'>(c);

    await db.spaceUser.update({ where: { id: spaceUser.id }, data: { deletedAt: new Date() } });

    return respond.noContent();
  },
);
