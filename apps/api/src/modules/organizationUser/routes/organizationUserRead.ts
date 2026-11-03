/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { organizationUserReadResponseSchema } from '#/modules/organizationUser/schemas/organizationUserSchemas';

export const organizationUserReadRoute = readRoute({
  model: Modules.organizationUser,
  responseSchema: organizationUserReadResponseSchema,
  middleware: [validatePermission('read')],
});
