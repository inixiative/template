/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses primitive:routeTemplates
 */
import { createRoute } from '#/lib/routeTemplates';
import {
  BILLING_RESOURCE_IMMUTABLE_FIELDS,
  billingResourceCreateBodySchema,
  billingResourceCreatePolymorphicSchema,
  billingResourceReadResponseSchema,
} from '#/modules/billingResource/schemas/billingResourceSchemas';
import { Modules } from '#/modules/modules';

export const billingResourceCreateRoute = createRoute({
  model: Modules.billingResource,
  skipId: true,
  bodySchema: billingResourceCreateBodySchema,
  bodyRefinement: (value, ctx) => {
    const parsed = billingResourceCreatePolymorphicSchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        });
      }
    }
  },
  responseSchema: billingResourceReadResponseSchema,
  sanitizeKeys: BILLING_RESOURCE_IMMUTABLE_FIELDS,
});
