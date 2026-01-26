import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { tokenDeleteRoute } from '#/modules/token/routes/tokenDelete';

export const tokenDeleteController = makeController(tokenDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const token = getResource<'token'>(c);

  await db.token.delete({ where: { id: token.id } });

  return respond.noContent();
});
