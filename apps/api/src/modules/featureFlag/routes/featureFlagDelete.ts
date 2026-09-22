/**
 * @atlas
 * @kind route
 * @partOf feature:featureFlag
 * @uses primitive:routeTemplates
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { featureFlagReadResponseSchema } from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';

export const featureFlagDeleteRoute = deleteRoute({
  model: Modules.featureFlag,
  middleware: [validatePermission('manage')],
  responseSchema: featureFlagReadResponseSchema,
});
