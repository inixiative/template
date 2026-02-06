import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyTokensRoute } from '#/modules/space/routes/spaceReadManyTokens';

export const spaceReadManyTokensController = makeController(spaceReadManyTokensRoute, async (c, respond) => {
  const db = c.get('db');
  const space = getResource<'space'>(c);

  const { data, pagination } = await paginate(c, db.token, {
    where: { spaceId: space.id },
    omit: { keyHash: true },
  });

  return respond.ok(data, { pagination });
});
