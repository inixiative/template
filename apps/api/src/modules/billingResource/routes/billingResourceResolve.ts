/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import {
  billingResourceResolveQuerySchema,
  billingResourceResolveResponseSchema,
} from '#/modules/billingResource/schemas/billingResourceSchemas';
import { Modules } from '#/modules/modules';

export const billingResourceResolveRoute = readRoute({
  model: Modules.billingResource,
  action: 'resolve',
  skipId: true,
  query: billingResourceResolveQuerySchema,
  responseSchema: billingResourceResolveResponseSchema,
  description: 'Resolves the effective billing account for a target scope or resource.',
});
