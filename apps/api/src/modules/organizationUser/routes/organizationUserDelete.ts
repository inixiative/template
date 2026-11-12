/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */

import { memberRemoval } from '@template/permissions/rebac/schemaHelpers';
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const organizationUserDeleteRoute = deleteRoute({
  model: Modules.organizationUser,
  middleware: [validatePermission(memberRemoval('organization'))],
});
