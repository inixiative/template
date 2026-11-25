/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { contextResource } from '#/lib/context/contextResource';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { makeController } from '#/lib/utils/makeController';
import { ownerColumns } from '#/modules/artifact/lib/artifactOwner';
import { paginateOwnerArtifacts } from '#/modules/artifact/services/paginateOwnerArtifacts';
import { organizationReadManyArtifactsRoute } from '#/modules/organization/routes/organizationReadManyArtifacts';

export const organizationReadManyArtifactsController = makeController(
  organizationReadManyArtifactsRoute,
  async (c, respond) => {
    const organization = contextResource<'organization'>(c);
    const owner = { ownerModel: 'Organization' as const, organizationId: organization.id };
    const allReadable = await holdsOnRecord(
      c.get('permix'),
      'artifact',
      { id: '', access: 'private', ...ownerColumns(owner) },
      'read',
    );
    const { data, pagination } = await paginateOwnerArtifacts(c, owner, { allReadable });
    return respond.ok(data, { pagination });
  },
);
