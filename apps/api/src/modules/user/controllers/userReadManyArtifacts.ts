/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/queries/ownerArtifactsQuery';
import { userReadManyArtifactsRoute } from '#/modules/user/routes/userReadManyArtifacts';

export const userReadManyArtifactsController = makeController(
  userReadManyArtifactsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifacts(c);
    return respond.ok(data, { pagination });
  },
);
