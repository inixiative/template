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
  middleware: [validatePermission('read')],
  responseSchema: flowResponseSchema,
});
