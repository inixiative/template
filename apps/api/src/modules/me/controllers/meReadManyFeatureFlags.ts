/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:featureFlag
 */

import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  type FeatureFlagWithVariants,
  includeFeatureFlagVariants,
  presentFeatureFlag,
} from '#/modules/featureFlag/queries/featureFlagIncludes';
import { meReadManyFeatureFlagsRoute } from '#/modules/me/routes/meReadManyFeatureFlags';

export const meReadManyFeatureFlagsController = makeController(meReadManyFeatureFlagsRoute, async (c, respond) => {
  const db = c.get('db');
  const owner = c.get('user')!;

  const { data, pagination } = await paginate<typeof db.featureFlag, FeatureFlagWithVariants>(c, db.featureFlag, {
    where: { ownerModel: 'User', userId: owner.id },
    include: includeFeatureFlagVariants,
  });

  return respond.ok(data.map(presentFeatureFlag), { pagination });
});
