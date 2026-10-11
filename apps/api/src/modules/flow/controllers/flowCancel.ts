/**
 * @atlas
 * @kind controller
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { flowCancelRoute } from '#/modules/flow/routes/flowCancel';
import { cancelFlow } from '#/modules/flow/services/cancelFlow';

export const flowCancelController = makeController(flowCancelRoute, async (c, respond) => {
  const flow = getResource<'flow'>(c);
  return respond.ok(await cancelFlow(flow.id));
});
