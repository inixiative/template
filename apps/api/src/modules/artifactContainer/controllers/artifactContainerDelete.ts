/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { removeArtifactFromContainer } from '#/modules/artifact/services/removeArtifactFromContainer';
import { artifactContainerDeleteRoute } from '#/modules/artifactContainer/routes/artifactContainerDelete';

export const artifactContainerDeleteController = makeController(
  artifactContainerDeleteRoute,
  async (c, respond) => {
    await removeArtifactFromContainer(
      artifactActorFromContext(c),
      getResource<'artifactContainer'>(c),
    );
    return respond.noContent();
  },
);
