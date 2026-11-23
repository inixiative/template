/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { fetchRootArtifacts } from '#/modules/artifact/services/fetchRootArtifacts';
import { spaceReadManyArtifactsRoute } from '#/modules/space/routes/spaceReadManyArtifacts';

export const spaceReadManyArtifactsController = makeController(
  spaceReadManyArtifactsRoute,
  async (c, respond) => {
    const roots = await fetchRootArtifacts(artifactActorFromContext(c), {
      ownerModel: 'Space',
      spaceId: contextResource<'space'>(c).id,
    });
    return respond.ok(roots);
  },
);
