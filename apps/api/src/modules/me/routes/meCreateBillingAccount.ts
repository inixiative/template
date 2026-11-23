/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:billing
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
import { OpenApiTags } from '#/modules/openApiTags';

export const meCreateBillingAccountRoute = createRoute({
  model: Modules.me,
  submodel: Modules.billingAccount,
  skipId: true,
  middleware: [validateSubmodelPermission('create')],
  bodySchema: billingAccountCreateBodySchema,
  responseSchema: billingAccountReadResponseSchema,
  sanitizeKeys: BILLING_ACCOUNT_IMMUTABLE_FIELDS,
  tags: [OpenApiTags.me, OpenApiTags.billingAccount],
});
