/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { removeArtifactPlacement } from '#/modules/artifact/services/removeArtifactPlacement';
import { artifactPlacementDeleteRoute } from '#/modules/artifactPlacement/routes/artifactPlacementDelete';

export const artifactPlacementDeleteController = makeController(
  artifactPlacementDeleteRoute,
  async (c, respond) => {
    await removeArtifactPlacement(c.get('permix'), contextResource<'artifactPlacement'>(c));
    return respond.noContent();
  },
);
