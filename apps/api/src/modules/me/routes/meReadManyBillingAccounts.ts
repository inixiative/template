/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:billing
 * @uses primitive:routeTemplates, primitive:authz, feature:billing
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { billingAccountReadResponseSchema } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meReadManyBillingAccountsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.billingAccount,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('BillingAccount') },
  middleware: [validatePermission('read')],
  responseSchema: billingAccountReadResponseSchema,
  tags: [OpenApiTags.me, OpenApiTags.billingAccount],
});
