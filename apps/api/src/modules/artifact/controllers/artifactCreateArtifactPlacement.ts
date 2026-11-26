/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactCreateArtifactPlacementRoute } from '#/modules/artifact/routes/artifactCreateArtifactPlacement';
import { targetOwnerFromBody } from '#/modules/artifact/services/artifactOwner';
import { createArtifactPlacement } from '#/modules/artifact/services/createArtifactPlacement';

export const artifactCreateArtifactPlacementController = makeController(
  artifactCreateArtifactPlacementRoute,
  async (c, respond) => {
    const body = c.req.valid('json');
    const target =
      body.containerArtifactId !== undefined
        ? { containerArtifactId: body.containerArtifactId }
        : { owner: targetOwnerFromBody(body) };
    const placement = await createArtifactPlacement(c.get('permix'), {
      artifact: contextResource<'artifact'>(c),
      ...target,
      access: body.access,
    });
    return respond.created(placement);
  },
);
