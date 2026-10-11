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

export const flowCancelRoute = actionRoute({
  model: Modules.flow,
  action: 'cancel',
  description: 'Cancels an open flow. The response carries the returnUrl to send the user back to.',
  middleware: [validatePermission('operate')],
  responseSchema: flowResponseSchema,
});
