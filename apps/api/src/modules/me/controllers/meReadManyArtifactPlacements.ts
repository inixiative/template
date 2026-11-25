/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPlacements } from '#/modules/artifactPlacement/lib/paginateOwnerArtifactPlacements';
import { meReadManyArtifactPlacementsRoute } from '#/modules/me/routes/meReadManyArtifactPlacements';

export const meReadManyArtifactPlacementsController = makeController(
  meReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifactPlacements(c, {
      ownerModel: 'User',
      userId: actingUser(c)!.id,
    });
    return respond.ok(data, { pagination });
  },
);
