/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses primitive:routeTemplates, primitive:authz
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { billingAccountReadResponseSchema } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { Modules } from '#/modules/modules';

export const billingAccountSyncRoute = actionRoute({
  model: Modules.billingAccount,
  action: 'sync',
  middleware: [validatePermission('manage')],
  responseSchema: billingAccountReadResponseSchema,
});
