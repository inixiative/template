/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { fetchRootArtifacts } from '#/modules/artifact/services/fetchRootArtifacts';
import { meReadManyArtifactsRoute } from '#/modules/me/routes/meReadManyArtifacts';

export const meReadManyArtifactsController = makeController(
  meReadManyArtifactsRoute,
  async (c, respond) => {
    const roots = await fetchRootArtifacts(artifactActorFromContext(c), {
      ownerModel: 'User',
      userId: actingUser(c)!.id,
    });
    return respond.ok(roots);
  },
);
