/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/services/paginateOwnerArtifacts';
import { meReadManyArtifactsRoute } from '#/modules/me/routes/meReadManyArtifacts';

export const meReadManyArtifactsController = makeController(
  meReadManyArtifactsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifacts(
      c,
      { ownerModel: 'User', userId: actingUser(c)!.id },
      { allReadable: true },
    );
    return respond.ok(data, { pagination });
  },
);
