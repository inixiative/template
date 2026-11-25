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
import { spaceReadManyArtifactsRoute } from '#/modules/space/routes/spaceReadManyArtifacts';

export const spaceReadManyArtifactsController = makeController(
  spaceReadManyArtifactsRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const owner = {
      ownerModel: 'Space' as const,
      organizationId: space.organizationId,
      spaceId: space.id,
    };
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
