/**
 * @atlas
 * @kind route
 * @partOf feature:featureFlag, superadmin
 * @uses primitive:routeTemplates
 */
import { createRoute } from '#/lib/routeTemplates/create';
import {
  FEATURE_FLAG_CREATE_IMMUTABLE_FIELDS,
  featureFlagCreateBodySchema,
  featureFlagReadResponseSchema,
} from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';

export const featureFlagCreateRoute = createRoute({
  model: Modules.featureFlag,
  admin: true,
  bodySchema: featureFlagCreateBodySchema,
  responseSchema: featureFlagReadResponseSchema,
  sanitizeKeys: FEATURE_FLAG_CREATE_IMMUTABLE_FIELDS,
  description: 'Creates a platform flag: a bare slug, addressed to the platform’s own customers.',
});
