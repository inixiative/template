/**
 * @atlas
 * @kind controller
 * @partOf feature:featureFlag
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { deleteVariant } from '#/modules/featureFlag/services/writeVariant';
import { featureFlagVariantDeleteRoute } from '#/modules/featureFlagVariant/routes/featureFlagVariantDelete';

export const featureFlagVariantDeleteController = makeController(featureFlagVariantDeleteRoute, async (c, respond) => {
  const { featureFlag: _flag, segment: _segment, ...variant } = getResource<'featureFlagVariant'>(c);
  await deleteVariant(variant);
  return respond.noContent();
});
