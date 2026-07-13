/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceCreateIntegrationRoute } from '#/modules/space/routes/spaceCreateIntegration';

export const spaceCreateIntegrationController = makeController(spaceCreateIntegrationRoute, async (c, respond) => {
  const db = c.get('db');
  const space = getResource<'space'>(c);
  const body = c.req.valid('json');

  const integration = await db.integration.create({
    data: {
      ...body,
      ownerModel: 'Space',
      spaceId: space.id,
    } as Prisma.IntegrationUncheckedCreateInput,
  });

  return respond.created(integration);
});
