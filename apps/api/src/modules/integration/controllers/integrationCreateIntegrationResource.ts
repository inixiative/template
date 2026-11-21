/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationCreateIntegrationResourceRoute } from '#/modules/integration/routes/integrationCreateIntegrationResource';
import { linkProjectResource } from '#/modules/project/services/linkProjectResource';

export const integrationCreateIntegrationResourceController = makeController(
  integrationCreateIntegrationResourceRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { id: integrationId } = contextResource<'integration'>(c);
    const { projectId, metadata, ...body } = c.req.valid('json');
    const resource = await db.txn(async () => {
      const created = await db.integrationResource.create({
        data: { ...body, integrationId, metadata: metadata as Prisma.InputJsonValue },
      });
      if (projectId)
        await linkProjectResource(c.get('permix'), {
          projectId,
          integrationResourceId: created.id,
        });
      return created;
    });
    return respond.created(resource);
  },
);
