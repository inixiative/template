/**
 * @atlas
 * @kind route
 * @partOf feature:billing, superadmin
 * @uses primitive:routeTemplates
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { billingResourceReadResponseSchema } from '#/modules/billingResource/schemas/billingResourceSchemas';
import { Modules } from '#/modules/modules';

export const adminBillingResourceReadManyRoute = readRoute({
  model: Modules.billingResource,
  many: true,
  paginate: true,
  skipId: true,
  admin: true,
  filterLens: { parent: lensFor('BillingResource') },
  responseSchema: billingResourceReadResponseSchema,
});
