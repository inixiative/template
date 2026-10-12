/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:integrations
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyIntegrationsRoute } from '#/modules/space/routes/spaceReadManyIntegrations';

export const spaceReadManyIntegrationsController = makeController(
  spaceReadManyIntegrationsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);

    const { data, pagination } = await paginate(c, db.integration, {
      where: { spaceId: space.id, ownerModel: 'Space' },
    });

    return respond.ok(data, { pagination });
  },
);
