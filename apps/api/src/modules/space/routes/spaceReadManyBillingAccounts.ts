/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy, feature:billing
 * @uses primitive:routeTemplates, primitive:authz, feature:billing
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { billingAccountReadResponseSchema } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { Modules } from '#/modules/modules';

export const spaceReadManyBillingAccountsRoute = readRoute({
  model: Modules.space,
  submodel: Modules.billingAccount,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('BillingAccount') },
  middleware: [validatePermission('read')],
  responseSchema: billingAccountReadResponseSchema,
});
