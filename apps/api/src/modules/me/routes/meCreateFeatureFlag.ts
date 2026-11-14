/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:featureFlag
 */
import { createRoute } from '#/lib/routeTemplates';

import {
  FEATURE_FLAG_CREATE_IMMUTABLE_FIELDS,
  featureFlagCreateBodySchema,
  featureFlagReadResponseSchema,
} from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meCreateFeatureFlagRoute = createRoute({
  model: Modules.me,
  submodel: Modules.featureFlag,
  skipId: true,

  bodySchema: featureFlagCreateBodySchema,
  responseSchema: featureFlagReadResponseSchema,
  sanitizeKeys: FEATURE_FLAG_CREATE_IMMUTABLE_FIELDS,
  tags: [Tags.me, Tags.featureFlag],
});
