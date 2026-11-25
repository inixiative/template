/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/services/paginateOwnerArtifacts';
import { spaceReadManyArtifactsRoute } from '#/modules/space/routes/spaceReadManyArtifacts';

export const spaceReadManyArtifactsController = makeController(
  spaceReadManyArtifactsRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const { data, pagination } = await paginateOwnerArtifacts(c, {
      ownerModel: 'Space',
      organizationId: space.organizationId,
      spaceId: space.id,
    });
    return respond.ok(data, { pagination });
  },
);
