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
  shapeAccessibleArtifacts,
} from '#/modules/artifact/queries/ownerArtifactsQuery';
import { spaceReadManyArtifactsRoute } from '#/modules/space/routes/spaceReadManyArtifacts';

export const spaceReadManyArtifactsController = makeController(
  spaceReadManyArtifactsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = contextResource<'space'>(c);
    const owner = {
      ownerModel: 'Space' as const,
      organizationId: space.organizationId,
      spaceId: space.id,
    };
    const { data, pagination } = await paginate(c, db.artifact, {
      where: await ownerArtifactsWhere(c, owner),
      include: includeArtifactList,
      orderBy: defaultArtifactOrderBy(c),
    });
    return respond.ok(await shapeAccessibleArtifacts(c, data), { pagination });
  },
);
