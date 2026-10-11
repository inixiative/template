/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, primitive:flows
 */
import { makeController } from '#/lib/utils/makeController';
import { createFlow } from '#/modules/flow/services/createFlow';
import { meCreateFlowRoute } from '#/modules/me/routes/meCreateFlow';

export const meCreateFlowController = makeController(meCreateFlowRoute, async (c, respond) => {
  const user = c.get('user')!;
  return respond.created(await createFlow(user.id, c.req.valid('json')));
});
