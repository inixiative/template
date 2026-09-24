/**
 * @atlas
 * @kind controller
 * @partOf feature:featureFlag
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { includeVariantSegment, presentVariant } from '#/modules/featureFlag/queries/featureFlagIncludes';
import { featureFlagCreateVariantRoute } from '#/modules/featureFlag/routes/featureFlagCreateVariant';
import { createVariant, type VariantWrite } from '#/modules/featureFlag/services/writeVariant';

export const featureFlagCreateVariantController = makeController(featureFlagCreateVariantRoute, async (c, respond) => {
  const db = c.get('db');
  const flag = getResource<'featureFlag'>(c);
  const body = c.req.valid('json');

  const created = await createVariant(flag, body as VariantWrite);
  const variant = await db.featureFlagVariant.findUniqueOrThrow({
    where: { id: created.id },
    include: includeVariantSegment,
  });

  return respond.created(presentVariant(variant));
});
