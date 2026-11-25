/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { placeArtifactAtRoot } from '#/modules/artifact/services/placeArtifactAtRoot';
import { spaceCreateArtifactPlacementRoute } from '#/modules/space/routes/spaceCreateArtifactPlacement';

export const spaceCreateArtifactPlacementController = makeController(
  spaceCreateArtifactPlacementRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const { artifactId } = c.req.valid('json');
    const placement = await placeArtifactAtRoot(
      c.get('permix'),
      { ownerModel: 'Space', organizationId: space.organizationId, spaceId: space.id },
      artifactId,
    );
    return respond.created(placement);
  },
);
