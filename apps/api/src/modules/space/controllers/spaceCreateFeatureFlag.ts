/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:featureFlag
 */
import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { includeFeatureFlagVariants, presentFeatureFlag } from '#/modules/featureFlag/queries/featureFlagIncludes';
import { createFeatureFlag } from '#/modules/featureFlag/services/createFeatureFlag';
import { spaceCreateFeatureFlagRoute } from '#/modules/space/routes/spaceCreateFeatureFlag';

export const spaceCreateFeatureFlagController = makeController(spaceCreateFeatureFlagRoute, async (c, respond) => {
  const db = c.get('db');
  const owner = getResource<'space'>(c);
  const body = c.req.valid('json');

  const flag = await createFeatureFlag({
    ...body,
    ownerModel: 'Space',
    spaceId: owner.id,
  } as Prisma.FeatureFlagUncheckedCreateInput);
  const row = await db.featureFlag.findUniqueOrThrow({ where: { id: flag.id }, include: includeFeatureFlagVariants });

  return respond.created(presentFeatureFlag(row));
});
