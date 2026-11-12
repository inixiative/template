/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */

import { OrganizationAction } from '@template/permissions/client';
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const organizationDeleteRoute = deleteRoute({
  model: Modules.organization,
  middleware: [validatePermission(OrganizationAction.delete)],
});
