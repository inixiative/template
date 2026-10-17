/**
 * @atlas
 * @kind route
 * @partOf feature:segment
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { segmentReadResponseSchema } from '#/modules/segment/schemas/segmentSchemas';

export const segmentDeleteRoute = deleteRoute({
  model: Modules.segment,
  middleware: [validatePermission('manage')],
  responseSchema: segmentReadResponseSchema,
});
