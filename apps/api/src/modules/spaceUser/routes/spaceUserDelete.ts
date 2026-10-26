/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const spaceUserDeleteRoute = deleteRoute({
  model: Modules.spaceUser,
  middleware: [validatePermission('delete')],
});
