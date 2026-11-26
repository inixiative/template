/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { moveArtifactPlacement } from '#/modules/artifact/services/moveArtifactPlacement';
import { artifactPlacementMoveRoute } from '#/modules/artifactPlacement/routes/artifactPlacementMove';

export const artifactPlacementMoveController = makeController(
  artifactPlacementMoveRoute,
  async (c, respond) => {
    const moved = await moveArtifactPlacement(
      c.get('permix'),
      contextResource<'artifactPlacement'>(c),
      c.req.valid('json'),
    );
    return respond.ok(moved);
  },
);
