/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma
 */
import { contextResource } from '#/lib/context/contextResource';
import { assertTransition } from '#/lib/permissions/assertTransition';
import { makeController } from '#/lib/utils/makeController';
import { integrationResourceUpdateRoute } from '#/modules/integrationResource/routes/integrationResourceUpdate';

export const integrationResourceUpdateController = makeController(
  integrationResourceUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const resource = contextResource<'integrationResource'>(c);
    const changes = c.req.valid('json');
    await assertTransition(
      c.get('permix'),
      'integrationResource',
      'changeStatus',
      resource,
      changes,
    );
    const updated = await db.integrationResource.update({
      where: { id: resource.id },
      data: changes,
    });
    return respond.ok(updated);
  },
);
