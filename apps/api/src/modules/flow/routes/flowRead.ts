/**
 * @atlas
 * @kind route
 * @partOf primitive:flows
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { flowResponseSchema } from '#/modules/flow/schemas/flowSchemas';
import { Modules } from '#/modules/modules';

export const flowReadRoute = readRoute({
  model: Modules.flow,
  description:
    'Rechecks every step from the first, as the caller. currentStep is the first step that does not hold. A finished flow is returned once, then deleted; a step whose read fails deletes the flow and answers 404.',
  middleware: [validatePermission('read')],
  responseSchema: flowResponseSchema,
});
