/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:auth
 */

import { me } from '#/lib/context/me';
import { makeController } from '#/lib/utils/makeController';
import { meCreateTokenRoute } from '#/modules/me/routes/meCreateToken';
import { createToken } from '#/modules/me/services/createToken';

export const meCreateTokenController = makeController(meCreateTokenRoute, async (c, respond) => {
  const user = me(c)!;
  const body = c.req.valid('json');

  const token = await createToken(c, { ...body, ownerModel: 'User', userId: user.id });

  return respond.created(token);
});
