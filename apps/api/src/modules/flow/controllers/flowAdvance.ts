/**
 * @atlas
 * @kind controller
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { flowAdvanceRoute } from '#/modules/flow/routes/flowAdvance';
import { advanceFlow } from '#/modules/flow/services/advanceFlow';

export const flowAdvanceController = makeController(flowAdvanceRoute, async (c, respond) => {
  const flow = getResource<'flow'>(c);
  const { currentStep } = c.req.valid('json');

  return respond.ok(await advanceFlow(flow.id, currentStep));
});
