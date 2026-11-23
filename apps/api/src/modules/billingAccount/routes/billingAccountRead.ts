/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { billingAccountReadResponseSchema } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { Modules } from '#/modules/modules';

export const billingAccountReadRoute = readRoute({
  model: Modules.billingAccount,
  middleware: [validatePermission('read')],
  responseSchema: billingAccountReadResponseSchema,
});
