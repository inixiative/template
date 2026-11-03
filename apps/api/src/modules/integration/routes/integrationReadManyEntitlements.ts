/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, primitive:authz
 */
import { entitlementRowSchema } from '@template/permissions/rebac';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const integrationReadManyEntitlementsRoute = readRoute({
  model: Modules.integration,
  submodel: Modules.entitlement,
  many: true,
  description: 'Lists the entitlements a integration holds, with the row ids that remove them.',
  middleware: [validatePermission('read')],
  responseSchema: entitlementRowSchema,
});
