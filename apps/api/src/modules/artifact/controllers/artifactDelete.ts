/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactDeleteRoute } from '#/modules/artifact/routes/artifactDelete';
import { deleteArtifact } from '#/modules/artifact/services/deleteArtifact';

export const artifactDeleteController = makeController(artifactDeleteRoute, async (c, respond) => {
  await deleteArtifact(artifactActorFromContext(c), getResource<'artifact'>(c));
  return respond.noContent();
});
