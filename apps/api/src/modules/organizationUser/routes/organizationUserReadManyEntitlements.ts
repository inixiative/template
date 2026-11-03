/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { lensFor } from '@template/db/lens';
import { entitlementRowSchema } from '@template/permissions/rebac';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const organizationUserReadManyEntitlementsRoute = readRoute({
  model: Modules.organizationUser,
  submodel: Modules.entitlement,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('Entitlement') },
  description: 'Lists the entitlements a member holds, with the row ids that remove them.',
  middleware: [validatePermission('read')],
  responseSchema: entitlementRowSchema,
});
