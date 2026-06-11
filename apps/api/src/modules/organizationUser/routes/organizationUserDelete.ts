/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const organizationUserDeleteRoute = deleteRoute({
  model: Modules.organizationUser,
});
