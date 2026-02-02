import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyTokenRoute } from '#/modules/space/routes/spaceReadManyToken';

export const spaceReadManyTokenController = makeController(spaceReadManyTokenRoute, async (c, respond) => {
  const db = c.get('db');
  const space = getResource<'space'>(c);
  const { page, pageSize } = c.req.valid('query');

  const { data, pagination } = await paginate(
    db.token,
    {
      where: { spaceId: space.id },
      omit: { keyHash: true },
    },
    { page, pageSize },
  );

  return respond.ok(data, { pagination });
});
