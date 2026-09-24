/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:featureFlag
 */
import type { Prisma } from '@template/db';

import { makeController } from '#/lib/utils/makeController';
import { includeFeatureFlagVariants, presentFeatureFlag } from '#/modules/featureFlag/queries/featureFlagIncludes';
import { createFeatureFlag } from '#/modules/featureFlag/services/createFeatureFlag';
import { meCreateFeatureFlagRoute } from '#/modules/me/routes/meCreateFeatureFlag';

export const meCreateFeatureFlagController = makeController(meCreateFeatureFlagRoute, async (c, respond) => {
  const db = c.get('db');
  const owner = c.get('user')!;
  const body = c.req.valid('json');

  const flag = await createFeatureFlag({
    ...body,
    ownerModel: 'User',
    userId: owner.id,
  } as Prisma.FeatureFlagUncheckedCreateInput);
  const row = await db.featureFlag.findUniqueOrThrow({ where: { id: flag.id }, include: includeFeatureFlagVariants });

  return respond.created(presentFeatureFlag(row));
});
