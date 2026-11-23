/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { fetchRootArtifacts } from '#/modules/artifact/services/fetchRootArtifacts';
import { spaceReadManyArtifactsRoute } from '#/modules/space/routes/spaceReadManyArtifacts';

export const spaceReadManyArtifactsController = makeController(
  spaceReadManyArtifactsRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const roots = await fetchRootArtifacts(c.get('permix'), {
      ownerModel: 'Space',
      organizationId: space.organizationId,
      spaceId: space.id,
    });
    return respond.ok(roots);
  },
);
