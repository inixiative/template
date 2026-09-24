/**
 * @atlas
 * @kind controller
 * @partOf feature:featureFlag
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { includeFeatureFlagVariants, presentFeatureFlag } from '#/modules/featureFlag/queries/featureFlagIncludes';
import { featureFlagUpdateRoute } from '#/modules/featureFlag/routes/featureFlagUpdate';

export const featureFlagUpdateController = makeController(featureFlagUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const flag = getResource<'featureFlag'>(c);
  const body = c.req.valid('json');

  const updated = await db.featureFlag.update({
    where: { id: flag.id },
    data: body as Prisma.FeatureFlagUncheckedUpdateInput,
    include: includeFeatureFlagVariants,
  });

  return respond.ok(presentFeatureFlag(updated));
});
