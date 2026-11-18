/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates
 */

import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { meRedactRoute } from '#/modules/me/routes/meRedact';
import { redactUser } from '#/modules/user/services/redactUser';

export const meRedactController = makeController(meRedactRoute, async (c, respond) => {
  const user = actingUser(c)!;

  await redactUser(c, user.id);

  return respond.noContent();
});
