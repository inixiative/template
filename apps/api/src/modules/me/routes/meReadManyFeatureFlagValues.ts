/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:featureFlag
 */
import { readRoute } from '#/lib/routeTemplates';
import { featureFlagValueSchema } from '#/modules/featureFlag/schemas/featureFlagSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadManyFeatureFlagValuesRoute = readRoute({
  model: Modules.me,
  submodel: Modules.featureFlagValue,
  many: true,
  skipId: true,
  responseSchema: featureFlagValueSchema,
  description:
    'Every flag value that applies to you at each provider you are a customer of, and to the organizations and spaces you act in. Values only.',
  tags: [Tags.me, Tags.featureFlag],
});
