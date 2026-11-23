/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, primitive:authz, infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import type { IntegrationResource } from '@template/db/generated/client/client';
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { assertTransition } from '#/lib/permissions/assertTransition';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { makeController } from '#/lib/utils/makeController';
import { integrationCreateIntegrationResourceRoute } from '#/modules/integration/routes/integrationCreateIntegrationResource';

export const integrationCreateIntegrationResourceController = makeController(
  integrationCreateIntegrationResourceRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permix = c.get('permix');
    const { id: integrationId } = contextResource<'integration'>(c);
    const { projectId, metadata, status, ...body } = c.req.valid('json');
    const key = { integrationId, kind: body.kind, externalId: body.externalId };
    const fields = { ...body, metadata: metadata as Prisma.InputJsonValue };
    const resource = await db.txn(async () => {
      const [existing] = await db.withDeleted(() =>
        db.findForUpdate<IntegrationResource>('IntegrationResource', key, { upserting: true }),
      );
      const registering = {
        ...fields,
        deletedAt: null,
        status: status ?? existing?.status ?? IntegrationResourceStatus.tracked,
      };
      await assertTransition(
        permix,
        'integrationResource',
        'register',
        existing ?? key,
        registering,
      );
      const registered = await db.withDeleted(() =>
        db.integrationResource.upsert({
          where: { integrationId_kind_externalId: key },
          create: { ...registering, integrationId },
          update: registering,
        }),
      );
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
