/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { placeArtifactAtRoot } from '#/modules/artifact/services/placeArtifactAtRoot';
import { organizationCreateArtifactPlacementRoute } from '#/modules/organization/routes/organizationCreateArtifactPlacement';

export const organizationCreateArtifactPlacementController = makeController(
  organizationCreateArtifactPlacementRoute,
  async (c, respond) => {
    const organization = contextResource<'organization'>(c);
    const { artifactId } = c.req.valid('json');
    const placement = await placeArtifactAtRoot(
      c.get('permix'),
      { ownerModel: 'Organization', organizationId: organization.id },
      artifactId,
    );
    return respond.created(placement);
  },
);
