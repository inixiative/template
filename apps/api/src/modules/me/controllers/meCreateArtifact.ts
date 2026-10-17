/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { createArtifact } from '#/modules/artifact/services/placeArtifact';
import { meCreateArtifactRoute } from '#/modules/me/routes/meCreateArtifact';

export const meCreateArtifactController = makeController(
  meCreateArtifactRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    const artifact = await createArtifact(artifactActorFromContext(c), {
      ...c.req.valid('json'),
      ownerModel: 'User',
      userId: user.id,
    });
    return respond.created(artifact);
  },
);
