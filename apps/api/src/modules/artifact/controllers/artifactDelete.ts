/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactDeleteRoute } from '#/modules/artifact/routes/artifactDelete';
import { deleteArtifact } from '#/modules/artifact/services/deleteArtifact';

export const artifactDeleteController = makeController(artifactDeleteRoute, async (c, respond) => {
  await deleteArtifact(artifactActorFromContext(c), contextResource<'artifact'>(c));
  return respond.noContent();
});
