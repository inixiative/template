/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { hydrate } from '@template/db';
import { check } from '@template/permissions/rebac';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/services/paginateOwnerArtifacts';
import { organizationReadManyArtifactsRoute } from '#/modules/organization/routes/organizationReadManyArtifacts';

export const organizationReadManyArtifactsController = makeController(
  organizationReadManyArtifactsRoute,
  async (c, respond) => {
    const organization = contextResource<'organization'>(c);
    const allReadable = check(
      c.get('permix'),
      'organization',
      await hydrate('organization', organization),
      'manage',
    );
    const { data, pagination } = await paginateOwnerArtifacts(
      c,
      { ownerModel: 'Organization', organizationId: organization.id },
      { allReadable },
    );
    return respond.ok(data, { pagination });
  },
);
