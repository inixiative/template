/**
 * @atlas
 * @kind route
 * @partOf feature:featureFlag
 * @uses primitive:routeTemplates
 */
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  featureFlagVariantCreateBodySchema,
  featureFlagVariantReadResponseSchema,
} from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const featureFlagCreateVariantRoute = createRoute({
  model: Modules.featureFlag,
  submodel: Modules.featureFlagVariant,
  middleware: [validatePermission('manage')],
  bodySchema: featureFlagVariantCreateBodySchema,
  responseSchema: featureFlagVariantReadResponseSchema,
  description:
    'Adds a rule (or the default) to a flag. A rule takes one audience: a shared segmentId or an internalSegment { type, conditions }.',
  tags: [Tags.featureFlag, Tags.featureFlagVariant],
});
