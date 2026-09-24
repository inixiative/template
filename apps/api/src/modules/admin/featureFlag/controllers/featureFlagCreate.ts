/**
 * @atlas
 * @kind controller
 * @partOf feature:featureFlag, superadmin
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import { makeController } from '#/lib/utils/makeController';
import { featureFlagCreateRoute } from '#/modules/admin/featureFlag/routes/featureFlagCreate';
import { includeFeatureFlagVariants, presentFeatureFlag } from '#/modules/featureFlag/queries/featureFlagIncludes';
import { createFeatureFlag } from '#/modules/featureFlag/services/createFeatureFlag';

export const featureFlagCreateController = makeController(featureFlagCreateRoute, async (c, respond) => {
  const db = c.get('db');
  const body = c.req.valid('json');

  const flag = await createFeatureFlag({ ...body, ownerModel: 'platform' } as Prisma.FeatureFlagUncheckedCreateInput);
  const row = await db.featureFlag.findUniqueOrThrow({ where: { id: flag.id }, include: includeFeatureFlagVariants });

  return respond.created(presentFeatureFlag(row));
});
