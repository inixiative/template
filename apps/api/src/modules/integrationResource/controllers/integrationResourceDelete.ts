/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationResourceDeleteRoute } from '#/modules/integrationResource/routes/integrationResourceDelete';

export const integrationResourceDeleteController = makeController(
  integrationResourceDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const resource = contextResource<'integrationResource'>(c);
    await db.integrationResource.update({
      where: { id: resource.id },
      data: { deletedAt: new Date() },
    });
    return respond.noContent();
  },
);
