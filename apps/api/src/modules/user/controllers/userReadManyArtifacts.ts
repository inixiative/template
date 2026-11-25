/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  defaultArtifactOrderBy,
  includeArtifactList,
  ownerArtifactsWhere,
  shapeReadableArtifacts,
} from '#/modules/artifact/lib/ownerArtifactsQuery';
import { userReadManyArtifactsRoute } from '#/modules/user/routes/userReadManyArtifacts';

export const userReadManyArtifactsController = makeController(
  userReadManyArtifactsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const user = contextResource<'user'>(c);
    const owner = { ownerModel: 'User' as const, userId: user.id };
    const { data, pagination } = await paginate(c, db.artifact, {
      where: await ownerArtifactsWhere(c, owner),
      include: includeArtifactList,
      orderBy: defaultArtifactOrderBy(c),
    });
    return respond.ok(await shapeReadableArtifacts(c, data), { pagination });
  },
);
