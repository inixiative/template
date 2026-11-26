/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  ownerArtifactsQuery,
  shapeAccessibleArtifacts,
} from '#/modules/artifact/queries/ownerArtifactsQuery';
import { userReadManyArtifactsRoute } from '#/modules/user/routes/userReadManyArtifacts';

export const userReadManyArtifactsController = makeController(
  userReadManyArtifactsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginate(
      c,
      c.get('db').artifact,
      await ownerArtifactsQuery(c),
    );
    return respond.ok(await shapeAccessibleArtifacts(c, data), { pagination });
  },
);
