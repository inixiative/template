import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManySpaceUserRoute } from '#/modules/space/routes/spaceReadManySpaceUser';

export const spaceReadManySpaceUserController = makeController(spaceReadManySpaceUserRoute, async (c, respond) => {
  const db = c.get('db');
  const space = getResource<'space'>(c);
  const { page, pageSize } = c.req.valid('query');

  const { data, pagination } = await paginate(
    db.spaceUser,
    {
      where: { spaceId: space.id },
      include: { user: true },
    },
    { page, pageSize },
  );

  return respond.ok(data, { pagination });
});
