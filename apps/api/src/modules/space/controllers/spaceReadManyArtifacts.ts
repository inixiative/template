/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { listRootArtifacts } from '#/modules/artifact/services/listRootArtifacts';
import { readableArtifacts } from '#/modules/artifact/services/readableArtifacts';
import { spaceReadManyArtifactsRoute } from '#/modules/space/routes/spaceReadManyArtifacts';

export const spaceReadManyArtifactsController = makeController(
  spaceReadManyArtifactsRoute,
  async (c, respond) => {
    const roots = await listRootArtifacts({
      ownerModel: 'Space',
      spaceId: getResource<'space'>(c).id,
    });
    return respond.ok(await readableArtifacts(artifactActorFromContext(c), roots));
  },
);
