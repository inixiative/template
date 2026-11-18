/**
 * @atlas
 * @kind controller
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { flowReadRoute } from '#/modules/flow/routes/flowRead';
import { advanceFlowAndDeleteWhenFinished } from '#/modules/flow/services/advanceFlowAndDeleteWhenFinished';

export const flowReadController = makeController(flowReadRoute, async (c, respond) => {
  return respond.ok(await advanceFlowAndDeleteWhenFinished(c, getResource<'flow'>(c)));
});
