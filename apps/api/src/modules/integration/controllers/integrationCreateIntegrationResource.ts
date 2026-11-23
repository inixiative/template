/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, primitive:authz, infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { makeController } from '#/lib/utils/makeController';
import { integrationCreateIntegrationResourceRoute } from '#/modules/integration/routes/integrationCreateIntegrationResource';
import { registerIntegrationResource } from '#/modules/integration/services/registerIntegrationResource';

export const integrationCreateIntegrationResourceController = makeController(
  integrationCreateIntegrationResourceRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permix = c.get('permix');
    const integration = contextResource<'integration'>(c);
    const { projectId, metadata, ...body } = c.req.valid('json');
    const resource = await db.txn(async () => {
      const registered = await registerIntegrationResource(permix, integration, {
        ...body,
        metadata: metadata as Prisma.InputJsonValue,
      });
      if (projectId) {
        const pair = { projectId, integrationResourceId: registered.id };
        if (
          !(await holdsOnRecord(
            permix,
            'projectIntegrationResource',
            { id: '', ...pair },
            'create',
          ))
        )
          throw makeError({ status: 403, message: 'Access denied' });
        await db.withDeleted(() =>
          db.projectIntegrationResource.upsert({
            where: { projectId_integrationResourceId: pair },
            create: pair,
            update: { deletedAt: null },
          }),
        );
      }
      return registered;
    });
    return respond.created(resource);
  },
);
