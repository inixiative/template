/**
 * @atlas
 * @kind controller
 * @partOf feature:project
 * @uses infrastructure:prisma
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { projectIntegrationResourceDeleteRoute } from '#/modules/projectIntegrationResource/routes/projectIntegrationResourceDelete';

export const projectIntegrationResourceDeleteController = makeController(
  projectIntegrationResourceDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const link = contextResource<'projectIntegrationResource'>(c);
    await db.projectIntegrationResource.update({
      where: { id: link.id },
      data: { deletedAt: new Date() },
    });
    return respond.noContent();
  },
);
