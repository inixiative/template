/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { placeArtifactAtRoot } from '#/modules/artifact/services/placeArtifactAtRoot';
import { spaceUserCreateArtifactPlacementRoute } from '#/modules/spaceUser/routes/spaceUserCreateArtifactPlacement';

export const spaceUserCreateArtifactPlacementController = makeController(
  spaceUserCreateArtifactPlacementRoute,
  async (c, respond) => {
    const member = contextResource<'spaceUser'>(c);
    const { artifactId } = c.req.valid('json');
    const placement = await placeArtifactAtRoot(
      c.get('permix'),
      {
        ownerModel: 'SpaceUser',
        organizationId: member.organizationId,
        spaceId: member.spaceId,
        userId: member.userId,
      },
      artifactId,
    );
    return respond.created(placement);
  },
);
