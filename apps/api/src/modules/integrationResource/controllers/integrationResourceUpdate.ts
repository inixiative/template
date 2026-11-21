/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 */
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationResourceUpdateRoute } from '#/modules/integrationResource/routes/integrationResourceUpdate';

export const integrationResourceUpdateController = makeController(
  integrationResourceUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const resource = contextResource<'integrationResource'>(c);
    const { status } = c.req.valid('json');
    if (
      status === IntegrationResourceStatus.tracked &&
      resource.status !== IntegrationResourceStatus.untracked
    )
      return respond.ok(resource);
    const updated = await db.integrationResource.update({
      where: { id: resource.id },
      data: { status },
    });
    return respond.ok(updated);
  },
);
