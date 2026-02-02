import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceUpdateRoute } from '#/modules/space/routes/spaceUpdate';

export const spaceUpdateController = makeController(spaceUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const space = getResource<'space'>(c);
  const body = c.req.valid('json');

  const updated = await db.space.update({
    where: { id: space.id },
    data: body,
  });

  return respond.ok(updated);
});
