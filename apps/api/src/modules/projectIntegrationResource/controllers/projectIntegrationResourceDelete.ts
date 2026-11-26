/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations, feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { projectIntegrationResourceDeleteRoute } from '#/modules/projectIntegrationResource/routes/projectIntegrationResourceDelete';

export const projectIntegrationResourceDeleteController = makeController(
  projectIntegrationResourceDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const projectIntegrationResource = contextResource<'projectIntegrationResource'>(c);
    await db.projectIntegrationResource.update({
      where: { id: projectIntegrationResource.id },
      data: { deletedAt: new Date(), isIdentity: false },
    });
    return respond.noContent();
  },
);
