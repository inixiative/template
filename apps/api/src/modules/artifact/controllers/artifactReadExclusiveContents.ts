/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactReadExclusiveContentsRoute } from '#/modules/artifact/routes/artifactReadExclusiveContents';
import { fetchExclusiveContents } from '#/modules/artifact/services/fetchExclusiveContents';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';

export const artifactReadExclusiveContentsController = makeController(
  artifactReadExclusiveContentsRoute,
  async (c, respond) => {
    const contents = await fetchExclusiveContents(contextResource<'artifact'>(c).id);
    return respond.ok(await listableArtifacts(artifactActorFromContext(c), contents));
  },
);
