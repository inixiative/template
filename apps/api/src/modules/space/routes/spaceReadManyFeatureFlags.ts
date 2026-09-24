/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:featureFlag
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { featureFlagReadResponseSchema } from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const spaceReadManyFeatureFlagsRoute = readRoute({
  model: Modules.space,
  submodel: Modules.featureFlag,
  many: true,

  middleware: [validatePermission('read')],
  paginate: true,
  filterLens: { parent: lensFor('FeatureFlag') },
  responseSchema: featureFlagReadResponseSchema,
  tags: [Tags.space, Tags.featureFlag],
});
