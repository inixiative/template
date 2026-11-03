/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates, primitive:authz
 */
import { lensFor } from '@template/db/lens';
import { entitlementRowSchema } from '@template/permissions/rebac';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const tokenReadManyEntitlementsRoute = readRoute({
  model: Modules.token,
  submodel: Modules.entitlement,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('Entitlement') },
  description: 'Lists the entitlements a token holds, with the row ids that remove them.',
  middleware: [validatePermission('read')],
  responseSchema: entitlementRowSchema,
});
