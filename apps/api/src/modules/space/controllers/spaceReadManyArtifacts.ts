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
import { spaceReadManyArtifactsRoute } from '#/modules/space/routes/spaceReadManyArtifacts';

export const spaceReadManyArtifactsController = makeController(
  spaceReadManyArtifactsRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const allReadable = check(c.get('permix'), 'space', await hydrate('space', space), 'manage');
    const { data, pagination } = await paginateOwnerArtifacts(
      c,
      { ownerModel: 'Space', organizationId: space.organizationId, spaceId: space.id },
      { allReadable },
    );
    return respond.ok(data, { pagination });
  },
);
