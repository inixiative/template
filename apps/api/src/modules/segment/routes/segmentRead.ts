/**
 * @atlas
 * @kind route
 * @partOf feature:segment
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { segmentReadResponseSchema } from '#/modules/segment/schemas/segmentSchemas';

export const segmentReadRoute = readRoute({
  model: Modules.segment,
  middleware: [validatePermission('read')],
  responseSchema: segmentReadResponseSchema,
});
