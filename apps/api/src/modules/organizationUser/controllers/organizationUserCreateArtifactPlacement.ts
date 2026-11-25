/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { placeArtifactAtRoot } from '#/modules/artifact/services/placeArtifactAtRoot';
import { organizationUserCreateArtifactPlacementRoute } from '#/modules/organizationUser/routes/organizationUserCreateArtifactPlacement';

export const organizationUserCreateArtifactPlacementController = makeController(
  organizationUserCreateArtifactPlacementRoute,
  async (c, respond) => {
    const member = contextResource<'organizationUser'>(c);
    const { artifactId } = c.req.valid('json');
    const placement = await placeArtifactAtRoot(
      c.get('permix'),
      {
        ownerModel: 'OrganizationUser',
        organizationId: member.organizationId,
        userId: member.userId,
      },
      artifactId,
    );
    return respond.created(placement);
  },
);
