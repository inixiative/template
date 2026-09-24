/**
 * @atlas
 * @kind route
 * @partOf feature:featureFlag
 * @uses primitive:routeTemplates
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { featureFlagVariantReadResponseSchema } from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';

export const featureFlagVariantDeleteRoute = deleteRoute({
  model: Modules.featureFlagVariant,
  middleware: [validatePermission('manage')],
  responseSchema: featureFlagVariantReadResponseSchema,
});
