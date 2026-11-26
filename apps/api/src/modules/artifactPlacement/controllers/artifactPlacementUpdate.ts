/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { updateArtifactPlacement } from '#/modules/artifact/services/updateArtifactPlacement';
import { artifactPlacementUpdateRoute } from '#/modules/artifactPlacement/routes/artifactPlacementUpdate';

export const artifactPlacementUpdateController = makeController(
  artifactPlacementUpdateRoute,
  async (c, respond) => {
    const updated = await updateArtifactPlacement(
      c.get('permix'),
      contextResource<'artifactPlacement'>(c),
      c.req.valid('json'),
    );
    return respond.ok(updated);
  },
);
