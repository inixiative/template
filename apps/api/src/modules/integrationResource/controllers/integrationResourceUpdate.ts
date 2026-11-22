/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationResourceUpdateRoute } from '#/modules/integrationResource/routes/integrationResourceUpdate';

export const integrationResourceUpdateController = makeController(
  integrationResourceUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const resource = contextResource<'integrationResource'>(c);
    const updated = await db.integrationResource.update({
      where: { id: resource.id },
      data: c.req.valid('json'),
    });
    return respond.ok(updated);
  },
);
