/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import type { IntegrationResource } from '@template/db/generated/client/client';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
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
      const key = { integrationId, kind: body.kind, externalId: body.externalId };
      const held = await db.findForUpdate<IntegrationResource>('IntegrationResource', key, {
        upserting: true,
      });
      if (held.some((row) => row.deletedAt === null))
        throw makeError({ status: 409, message: 'This provider resource is already registered' });
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
