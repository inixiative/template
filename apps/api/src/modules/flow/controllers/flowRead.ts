/**
 * @atlas
 * @kind controller
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { flowReadRoute } from '#/modules/flow/routes/flowRead';
import { currentStepProgress } from '#/modules/flow/services/advanceSatisfiedSteps';
import { presentFlow } from '#/modules/flow/services/presentFlow';

export const flowReadController = makeController(flowReadRoute, async (c, respond) => {
  const flow = getResource<'flow'>(c);
  const { progress } = await currentStepProgress(c, flow);
  return respond.ok(presentFlow(flow, progress));
});
