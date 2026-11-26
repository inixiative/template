/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/queries/ownerArtifactsQuery';
import { spaceReadManyArtifactsRoute } from '#/modules/space/routes/spaceReadManyArtifacts';

export const spaceReadManyArtifactsController = makeController(
  spaceReadManyArtifactsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifacts(c);
    return respond.ok(data, { pagination });
  },
);
