/**
 * @atlas
 * @kind route
 * @partOf feature:segment
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const segmentMemberDeleteRoute = deleteRoute({
  model: Modules.segmentMember,
  middleware: [validatePermission('manage')],
});
