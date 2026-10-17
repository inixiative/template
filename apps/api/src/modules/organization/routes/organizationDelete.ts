/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { SessionAction } from '@template/permissions/client';
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import { Modules } from '#/modules/modules';

export const organizationDeleteRoute = deleteRoute({
  model: Modules.organization,
  middleware: [validateSelfPermission(SessionAction.deleteOrganization), validatePermission('own')],
});
