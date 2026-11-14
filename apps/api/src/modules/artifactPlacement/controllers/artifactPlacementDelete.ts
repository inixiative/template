/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { removeArtifactPlacement } from '#/modules/artifact/services/removeArtifactPlacement';
import { artifactPlacementDeleteRoute } from '#/modules/artifactPlacement/routes/artifactPlacementDelete';

export const artifactPlacementDeleteController = makeController(
  artifactPlacementDeleteRoute,
  async (c, respond) => {
    await removeArtifactPlacement(artifactActorFromContext(c), getResource<'artifactPlacement'>(c));
    return respond.noContent();
  },
);
