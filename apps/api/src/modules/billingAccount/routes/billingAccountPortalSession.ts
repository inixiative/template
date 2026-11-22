/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses primitive:routeTemplates, primitive:authz
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  billingAccountPortalSessionBodySchema,
  billingAccountPortalSessionResponseSchema,
} from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { Modules } from '#/modules/modules';

export const billingAccountPortalSessionRoute = actionRoute({
  model: Modules.billingAccount,
  action: 'portalSession',
  middleware: [validatePermission('manage')],
  bodySchema: billingAccountPortalSessionBodySchema,
  responseSchema: billingAccountPortalSessionResponseSchema,
});
