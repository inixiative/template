/**
 * @atlas
 * @kind controller
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { flowCheckRoute } from '#/modules/flow/routes/flowCheck';
import { checkFlow } from '#/modules/flow/services/checkFlow';

export const flowCheckController = makeController(flowCheckRoute, async (c, respond) => {
  const flow = getResource<'flow'>(c);
  return respond.ok(await checkFlow(c, flow.id));
});
