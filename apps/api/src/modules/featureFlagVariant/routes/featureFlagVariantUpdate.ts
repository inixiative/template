/**
 * @atlas
 * @kind route
 * @partOf feature:featureFlag
 * @uses primitive:routeTemplates
 */
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  featureFlagVariantReadResponseSchema,
  featureFlagVariantUpdateBodySchema,
} from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';

export const featureFlagVariantUpdateRoute = updateRoute({
  model: Modules.featureFlagVariant,
  middleware: [validatePermission('manage')],
  bodySchema: featureFlagVariantUpdateBodySchema,
  responseSchema: featureFlagVariantReadResponseSchema,
  description: 'Edits a variant. position reorders it; the audience fields replace its segment as on create.',
});
