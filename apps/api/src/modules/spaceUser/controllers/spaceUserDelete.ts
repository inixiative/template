/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { db } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserDeleteRoute } from '#/modules/spaceUser/routes/spaceUserDelete';

export const spaceUserDeleteController = makeController(
  spaceUserDeleteRoute,
  async (c, respond) => {
    const spaceUser = getResource<'spaceUser'>(c);

    await db.spaceUser.delete({ where: { id: spaceUser.id } });

    return respond.noContent();
  },
);
