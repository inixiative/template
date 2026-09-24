/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:featureFlag
 */
import { makeController } from '#/lib/utils/makeController';
import { requestFeatureFlags } from '#/modules/featureFlag/services/requestFeatureFlags';
import { subjectFeatureFlagValues } from '#/modules/featureFlag/services/subjectFeatureFlagValues';
import { meReadManyFeatureFlagValuesRoute } from '#/modules/me/routes/meReadManyFeatureFlagValues';

export const meReadManyFeatureFlagValuesController = makeController(
  meReadManyFeatureFlagValuesRoute,
  async (c, respond) => respond.ok(subjectFeatureFlagValues(await requestFeatureFlags(c))),
);
