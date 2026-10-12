/**
 * @atlas
 * @kind controller
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { flowReadRoute } from '#/modules/flow/routes/flowRead';
import { recheckFlow } from '#/modules/flow/services/recheckFlow';

export const flowReadController = makeController(flowReadRoute, async (c, respond) => {
  const flow = await recheckFlow(c, getResource<'flow'>(c));
  if (!flow) throw makeError({ status: 404, message: 'Flow ended' });
  return respond.ok(flow);
});
