/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { placeArtifactAtRoot } from '#/modules/artifact/services/placeArtifactAtRoot';
import { meCreateArtifactPlacementRoute } from '#/modules/me/routes/meCreateArtifactPlacement';

export const meCreateArtifactPlacementController = makeController(
  meCreateArtifactPlacementRoute,
  async (c, respond) => {
    const { artifactId } = c.req.valid('json');
    const placement = await placeArtifactAtRoot(
      c.get('permix'),
      { ownerModel: 'User', userId: actingUser(c)!.id },
      artifactId,
    );
    return respond.created(placement);
  },
);
