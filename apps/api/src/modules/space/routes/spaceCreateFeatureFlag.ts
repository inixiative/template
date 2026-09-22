/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:featureFlag
 */
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  FEATURE_FLAG_CREATE_IMMUTABLE_FIELDS,
  featureFlagCreateBodySchema,
  featureFlagReadResponseSchema,
} from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const spaceCreateFeatureFlagRoute = createRoute({
  model: Modules.space,
  submodel: Modules.featureFlag,

  middleware: [validatePermission('manage')],
  bodySchema: featureFlagCreateBodySchema,
  responseSchema: featureFlagReadResponseSchema,
  sanitizeKeys: FEATURE_FLAG_CREATE_IMMUTABLE_FIELDS,
  tags: [Tags.space, Tags.featureFlag],
});
