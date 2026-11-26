/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactCreateArtifactPlacementRoute } from '#/modules/artifact/routes/artifactCreateArtifactPlacement';
import { placeArtifact } from '#/modules/artifact/services/placeArtifact';

export const artifactCreateArtifactPlacementController = makeController(
  artifactCreateArtifactPlacementRoute,
  async (c, respond) => {
    const artifact = contextResource<'artifact'>(c);
    const body = c.req.valid('json');
    const edge = body.containerArtifactId
      ? await placeArtifact(c.get('permix'), {
          artifact,
          containerArtifactId: body.containerArtifactId,
          access: body.access,
        })
      : await placeArtifact(c.get('permix'), {
          artifact,
          owner: {
            ownerModel: body.ownerModel!,
            userId: body.userId,
            organizationId: body.organizationId,
            spaceId: body.spaceId,
          },
          access: body.access,
        });
    return respond.created(edge);
  },
);
