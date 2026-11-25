/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/services/paginateOwnerArtifacts';
import { userReadManyArtifactsRoute } from '#/modules/user/routes/userReadManyArtifacts';

export const userReadManyArtifactsController = makeController(
  userReadManyArtifactsRoute,
  async (c, respond) => {
    const user = contextResource<'user'>(c);
    const { data, pagination } = await paginateOwnerArtifacts(c, {
      ownerModel: 'User',
      userId: user.id,
    });
    return respond.ok(data, { pagination });
  },
);
