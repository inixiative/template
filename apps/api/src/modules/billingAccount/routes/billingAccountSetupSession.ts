/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses primitive:routeTemplates, primitive:authz
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  billingAccountSetupSessionBodySchema,
  billingAccountSetupSessionResponseSchema,
} from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { Modules } from '#/modules/modules';

export const billingAccountSetupSessionRoute = actionRoute({
  model: Modules.billingAccount,
  action: 'setupSession',
  middleware: [validatePermission('manage')],
  bodySchema: billingAccountSetupSessionBodySchema,
  responseSchema: billingAccountSetupSessionResponseSchema,
});
