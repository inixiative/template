/**
 * @atlas
 * @kind controller
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { flowReadRoute } from '#/modules/flow/routes/flowRead';
import { checkFlow } from '#/modules/flow/services/checkFlow';

export const flowReadController = makeController(flowReadRoute, async (c, respond) => {
  return respond.ok(await checkFlow(c, getResource<'flow'>(c)));
});
