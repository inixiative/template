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
import { organizationCreateFeatureFlagRoute } from '#/modules/organization/routes/organizationCreateFeatureFlag';

export const organizationCreateFeatureFlagController = makeController(
  organizationCreateFeatureFlagRoute,
  async (c, respond) => {
    const db = c.get('db');
    const owner = getResource<'organization'>(c);
    const body = c.req.valid('json');

    const flag = await createFeatureFlag({
      ...body,
      ownerModel: 'Organization',
      organizationId: owner.id,
    } as Prisma.FeatureFlagUncheckedCreateInput);
    const row = await db.featureFlag.findUniqueOrThrow({ where: { id: flag.id }, include: includeFeatureFlagVariants });

    return respond.created(presentFeatureFlag(row));
  },
);
