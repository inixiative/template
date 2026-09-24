/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:featureFlag
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';

import { featureFlagReadResponseSchema } from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadManyFeatureFlagsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.featureFlag,
  many: true,
  skipId: true,

  paginate: true,
  filterLens: { parent: lensFor('FeatureFlag') },
  responseSchema: featureFlagReadResponseSchema,
  tags: [Tags.me, Tags.featureFlag],
});
