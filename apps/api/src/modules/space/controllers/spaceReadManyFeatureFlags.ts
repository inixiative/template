/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:featureFlag
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  type FeatureFlagWithVariants,
  includeFeatureFlagVariants,
  presentFeatureFlag,
} from '#/modules/featureFlag/queries/featureFlagIncludes';
import { spaceReadManyFeatureFlagsRoute } from '#/modules/space/routes/spaceReadManyFeatureFlags';

export const spaceReadManyFeatureFlagsController = makeController(
  spaceReadManyFeatureFlagsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const owner = getResource<'space'>(c);

    const { data, pagination } = await paginate<typeof db.featureFlag, FeatureFlagWithVariants>(c, db.featureFlag, {
      where: { ownerModel: 'Space', spaceId: owner.id },
      include: includeFeatureFlagVariants,
    });

    return respond.ok(data.map(presentFeatureFlag), { pagination });
  },
);
