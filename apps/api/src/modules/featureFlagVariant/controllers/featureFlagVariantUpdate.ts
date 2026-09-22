/**
 * @atlas
 * @kind controller
 * @partOf feature:featureFlag
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { includeVariantSegment, presentVariant } from '#/modules/featureFlag/queries/featureFlagIncludes';
import { updateVariant, type VariantWrite } from '#/modules/featureFlag/services/writeVariant';
import { featureFlagVariantUpdateRoute } from '#/modules/featureFlagVariant/routes/featureFlagVariantUpdate';

export const featureFlagVariantUpdateController = makeController(featureFlagVariantUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const { featureFlag, segment: _segment, ...variant } = getResource<'featureFlagVariant'>(c);
  const body = c.req.valid('json');

  const updated = await updateVariant(featureFlag, variant, body as VariantWrite);
  const row = await db.featureFlagVariant.findUniqueOrThrow({
    where: { id: updated.id },
    include: includeVariantSegment,
  });

  return respond.ok(presentVariant(row));
});
