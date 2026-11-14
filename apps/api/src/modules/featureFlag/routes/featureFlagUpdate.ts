/**
 * @atlas
 * @kind route
 * @partOf feature:featureFlag
 * @uses primitive:routeTemplates
 */
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  FEATURE_FLAG_CREATE_IMMUTABLE_FIELDS,
  featureFlagReadResponseSchema,
  featureFlagUpdateBodySchema,
} from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';

export const featureFlagUpdateRoute = updateRoute({
  model: Modules.featureFlag,
  middleware: [validatePermission('manage')],
  bodySchema: featureFlagUpdateBodySchema,
  sanitizeKeys: FEATURE_FLAG_CREATE_IMMUTABLE_FIELDS,
  responseSchema: featureFlagReadResponseSchema,
});
