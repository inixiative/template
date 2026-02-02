import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceDeleteRoute } from '#/modules/space/routes/spaceDelete';

export const spaceDeleteController = makeController(spaceDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const space = getResource<'space'>(c);

  await db.space.update({
    where: { id: space.id },
    data: { deletedAt: new Date() },
  });

  return respond.noContent();
});
