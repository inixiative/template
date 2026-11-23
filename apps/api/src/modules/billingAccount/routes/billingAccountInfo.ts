/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import { billingAccountInfoResponseSchema } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { Modules } from '#/modules/modules';

export const billingAccountInfoRoute = readRoute({
  model: Modules.billingAccount,
  action: 'info',
  skipId: true,
  responseSchema: billingAccountInfoResponseSchema,
  description: 'Returns default billing provider and provider capabilities.',
});
