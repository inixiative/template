/**
 * @atlas
 * @kind route
 * @partOf primitive:flows
 * @uses primitive:routeTemplates, primitive:authz
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { flowAdvanceBodySchema, flowResponseSchema } from '#/modules/flow/schemas/flowSchemas';
import { Modules } from '#/modules/modules';

export const flowAdvanceRoute = actionRoute({
  model: Modules.flow,
  action: 'advance',
  description:
    'Completes the step named by currentStep and moves the flow to the next one; completing the last step completes the flow. Repeating an advance of a step already completed returns the flow unchanged.',
  middleware: [validatePermission('operate')],
  bodySchema: flowAdvanceBodySchema,
  responseSchema: flowResponseSchema,
});
