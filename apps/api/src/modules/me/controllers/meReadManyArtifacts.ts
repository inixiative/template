/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  defaultArtifactOrderBy,
  includeArtifactList,
  ownerArtifactsWhere,
  shapeAccessibleArtifacts,
} from '#/modules/artifact/queries/ownerArtifactsQuery';
import { meReadManyArtifactsRoute } from '#/modules/me/routes/meReadManyArtifacts';

export const meReadManyArtifactsController = makeController(
  meReadManyArtifactsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const owner = { ownerModel: 'User' as const, userId: actingUser(c)!.id };
    const { data, pagination } = await paginate(c, db.artifact, {
      where: await ownerArtifactsWhere(c, owner),
      include: includeArtifactList,
      orderBy: defaultArtifactOrderBy(c),
    });
    return respond.ok(await shapeAccessibleArtifacts(c, data), { pagination });
  },
);
