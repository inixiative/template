/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactDeleteRoute } from '#/modules/artifact/routes/artifactDelete';
import { deleteArtifact } from '#/modules/artifact/services/deleteArtifact';

export const artifactDeleteController = makeController(artifactDeleteRoute, async (c, respond) => {
  await deleteArtifact(c.get('permix'), contextResource<'artifact'>(c));
  return respond.noContent();
});
