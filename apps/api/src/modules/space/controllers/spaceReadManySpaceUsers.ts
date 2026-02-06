import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManySpaceUsersRoute } from '#/modules/space/routes/spaceReadManySpaceUsers';

export const spaceReadManySpaceUsersController = makeController(spaceReadManySpaceUsersRoute, async (c, respond) => {
  const db = c.get('db');
  const space = getResource<'space'>(c);

  const { data, pagination } = await paginate(c, db.spaceUser, {
    where: { spaceId: space.id },
    include: { user: true },
  });

  return respond.ok(data, { pagination });
});
