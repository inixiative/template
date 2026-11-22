/**
 * @atlas
 * @kind route
 * @partOf feature:billing, superadmin
 * @uses primitive:routeTemplates
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { billingAccountReadResponseSchema } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { Modules } from '#/modules/modules';

export const adminBillingAccountReadManyRoute = readRoute({
  model: Modules.billingAccount,
  many: true,
  paginate: true,
  skipId: true,
  admin: true,
  filterLens: { parent: lensFor('BillingAccount') },
  responseSchema: billingAccountReadResponseSchema,
});
