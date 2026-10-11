/**
 * @atlas
 * @kind route
 * @partOf primitive:flows
 * @uses primitive:routeTemplates, primitive:authz
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { flowResponseSchema } from '#/modules/flow/schemas/flowSchemas';
import { Modules } from '#/modules/modules';

export const flowCheckRoute = actionRoute({
  model: Modules.flow,
  action: 'check',
  description:
    'Re-evaluates the current step against its bound read route, as the caller, and advances through every step whose rule now holds. Completing the last step completes the flow.',
  middleware: [validatePermission('operate')],
  responseSchema: flowResponseSchema,
});
