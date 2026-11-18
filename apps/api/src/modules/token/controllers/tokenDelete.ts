/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { tokenDeleteRoute } from '#/modules/token/routes/tokenDelete';

export const tokenDeleteController = makeController(tokenDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const token = contextResource<'token'>(c);

  await db.token.update({ where: { id: token.id }, data: { deletedAt: new Date() } });

  return respond.noContent();
});
