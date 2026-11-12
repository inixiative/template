/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { tokenDeleteRoute } from '#/modules/token/routes/tokenDelete';

export const tokenDeleteController = makeController(tokenDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const token = getResource<'token'>(c);

  await db.token.update({ where: { id: token.id }, data: { deletedAt: new Date() } });

  return respond.noContent();
});
