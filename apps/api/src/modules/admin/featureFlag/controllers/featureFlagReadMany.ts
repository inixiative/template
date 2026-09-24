/**
 * @atlas
 * @kind controller
 * @partOf feature:featureFlag, superadmin
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { featureFlagReadManyRoute } from '#/modules/admin/featureFlag/routes/featureFlagReadMany';
import {
  type FeatureFlagWithVariants,
  includeFeatureFlagVariants,
  presentFeatureFlag,
} from '#/modules/featureFlag/queries/featureFlagIncludes';

export const featureFlagReadManyController = makeController(featureFlagReadManyRoute, async (c, respond) => {
  const db = c.get('db');
  const { data, pagination } = await paginate<typeof db.featureFlag, FeatureFlagWithVariants>(c, db.featureFlag, {
    include: includeFeatureFlagVariants,
  });
  return respond.ok(data.map(presentFeatureFlag), { pagination });
});
