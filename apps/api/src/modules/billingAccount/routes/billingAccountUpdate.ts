/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses primitive:routeTemplates, primitive:authz
 */
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  BILLING_ACCOUNT_IMMUTABLE_FIELDS,
  billingAccountReadResponseSchema,
  billingAccountUpdateBodySchema,
} from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { Modules } from '#/modules/modules';

export const billingAccountUpdateRoute = updateRoute({
  model: Modules.billingAccount,
  middleware: [validatePermission('manage')],
  bodySchema: billingAccountUpdateBodySchema,
  sanitizeKeys: BILLING_ACCOUNT_IMMUTABLE_FIELDS,
  responseSchema: billingAccountReadResponseSchema,
});
