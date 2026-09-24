/**
 * @atlas
 * @kind route
 * @partOf feature:featureFlag, superadmin
 * @uses primitive:routeTemplates
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates/read';
import { featureFlagReadResponseSchema } from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';

export const featureFlagReadManyRoute = readRoute({
  model: Modules.featureFlag,
  many: true,
  admin: true,
  paginate: true,
  filterLens: { parent: lensFor('FeatureFlag') },
  responseSchema: featureFlagReadResponseSchema,
  description: 'Every flag of every owner; filter on ownerModel for the platform’s own.',
});
