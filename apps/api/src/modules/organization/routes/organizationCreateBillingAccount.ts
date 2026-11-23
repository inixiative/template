/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy, feature:billing
 * @uses primitive:routeTemplates, feature:billing
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import {
  BILLING_ACCOUNT_IMMUTABLE_FIELDS,
  billingAccountCreateBodySchema,
  billingAccountReadResponseSchema,
} from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { Modules } from '#/modules/modules';

export const organizationCreateBillingAccountRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.billingAccount,
  middleware: [validateSubmodelPermission('create')],
  bodySchema: billingAccountCreateBodySchema,
  responseSchema: billingAccountReadResponseSchema,
  sanitizeKeys: BILLING_ACCOUNT_IMMUTABLE_FIELDS,
});
