/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
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
} from '#/modules/artifact/queries/ownerArtifactsQuery';
import { spaceUserReadManyArtifactsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyArtifacts';

export const spaceUserReadManyArtifactsController = makeController(
  spaceUserReadManyArtifactsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = contextResource<'spaceUser'>(c);
    const owner = {
      ownerModel: 'SpaceUser' as const,
      organizationId: member.organizationId,
      spaceId: member.spaceId,
      userId: member.userId,
    };
    const { data, pagination } = await paginate(c, db.artifact, {
      where: await ownerArtifactsWhere(c, owner),
      include: includeArtifactList,
      orderBy: defaultArtifactOrderBy(c),
    });
    return respond.ok(await shapeReadableArtifacts(c, data), { pagination });
  },
);
