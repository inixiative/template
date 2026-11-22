/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma
 */
import type { IntegrationResource } from '@template/db/generated/client/client';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { assertTransition } from '#/lib/permissions/assertTransition';
import { makeController } from '#/lib/utils/makeController';
import { integrationResourceUpdateRoute } from '#/modules/integrationResource/routes/integrationResourceUpdate';

export const integrationResourceUpdateController = makeController(
  integrationResourceUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { id } = contextResource<'integrationResource'>(c);
    const changes = c.req.valid('json');
    const updated = await db.txn(async () => {
      const [resource] = await db.findForUpdate<IntegrationResource>('IntegrationResource', { id });
      if (!resource) throw makeError({ status: 404, message: 'Integration resource not found' });
      await assertTransition(
        c.get('permix'),
        'integrationResource',
        'changeStatus',
        resource,
        changes,
      );
      return db.integrationResource.update({ where: { id }, data: changes });
    });
    return respond.ok(updated);
  },
);
