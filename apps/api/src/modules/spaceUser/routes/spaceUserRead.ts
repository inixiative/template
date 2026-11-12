/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { spaceUserReadResponseSchema } from '#/modules/spaceUser/schemas/spaceUserSchemas';

export const spaceUserReadRoute = readRoute({
  model: Modules.spaceUser,
  responseSchema: spaceUserReadResponseSchema,
  middleware: [validatePermission('read')],
});
