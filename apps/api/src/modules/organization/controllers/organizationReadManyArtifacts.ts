/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/services/paginateOwnerArtifacts';
import { organizationReadManyArtifactsRoute } from '#/modules/organization/routes/organizationReadManyArtifacts';

export const organizationReadManyArtifactsController = makeController(
  organizationReadManyArtifactsRoute,
  async (c, respond) => {
    const organization = contextResource<'organization'>(c);
    const { data, pagination } = await paginateOwnerArtifacts(c, {
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    return respond.ok(data, { pagination });
  },
);
