/**
 * @atlas
 * @kind controller
 * @partOf feature:featureFlag
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { presentFeatureFlag } from '#/modules/featureFlag/queries/featureFlagIncludes';
import { featureFlagReadRoute } from '#/modules/featureFlag/routes/featureFlagRead';

export const featureFlagReadController = makeController(featureFlagReadRoute, async (c, respond) => {
  const flag = getResource<'featureFlag'>(c);
  return respond.ok(presentFeatureFlag(flag));
});
