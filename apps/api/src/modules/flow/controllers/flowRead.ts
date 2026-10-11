/**
 * @atlas
 * @kind controller
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { flowReadRoute } from '#/modules/flow/routes/flowRead';

export const flowReadController = makeController(flowReadRoute, async (c, respond) => {
  const flow = getResource<'flow'>(c);
  return respond.ok(flow);
});
