/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { billingResourceReadResponseSchema } from '#/modules/billingResource/schemas/billingResourceSchemas';
import { Modules } from '#/modules/modules';

export const billingResourceReadRoute = readRoute({
  model: Modules.billingResource,
  middleware: [validatePermission('read')],
  responseSchema: billingResourceReadResponseSchema,
});
