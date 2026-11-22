/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, primitive:flows
 */

import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { createFlow } from '#/modules/flow/services/createFlow';
import { meCreateFlowRoute } from '#/modules/me/routes/meCreateFlow';

export const meCreateFlowController = makeController(meCreateFlowRoute, async (c, respond) => {
  const user = actingUser(c)!;
  return respond.created(await createFlow(c, user.id, c.req.valid('json')));
});
