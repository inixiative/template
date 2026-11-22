/**
 * @atlas
 * @kind controller
 * @partOf feature:project
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { projectIntegrationDeleteRoute } from '#/modules/projectIntegration/routes/projectIntegrationDelete';

export const projectIntegrationDeleteController = makeController(
  projectIntegrationDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const projectIntegration = contextResource<'projectIntegration'>(c);
    await db.projectIntegration.update({
      where: { id: projectIntegration.id },
      data: { deletedAt: new Date() },
    });
    return respond.noContent();
  },
);
