/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactCreateArtifactPlacementRoute } from '#/modules/artifact/routes/artifactCreateArtifactPlacement';
import { placeArtifact } from '#/modules/artifact/services/artifactPlacements';

export const artifactCreateArtifactPlacementController = makeController(
  artifactCreateArtifactPlacementRoute,
  async (c, respond) => {
    const artifact = contextResource<'artifact'>(c);
    const { containerArtifactId, inherit } = c.req.valid('json');
    const edge = await placeArtifact(artifactActorFromContext(c), {
      artifactId: artifact.id,
      containerArtifactId,
      inherit,
    });
    return respond.created(edge);
  },
);
