/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { createArtifact } from '#/modules/artifact/services/createArtifact';
import { meCreateArtifactRoute } from '#/modules/me/routes/meCreateArtifact';

export const meCreateArtifactController = makeController(
  meCreateArtifactRoute,
  async (c, respond) => {
    const artifact = await createArtifact(c.get('permix'), {
      ...c.req.valid('json'),
      ownerModel: 'User',
      userId: actingUser(c)!.id,
    });
    return respond.created(artifact);
  },
);
