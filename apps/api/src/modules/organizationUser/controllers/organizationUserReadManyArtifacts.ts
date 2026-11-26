/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  ownerArtifactsQuery,
  shapeAccessibleArtifacts,
} from '#/modules/artifact/queries/ownerArtifactsQuery';
import { organizationUserReadManyArtifactsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifacts';

export const organizationUserReadManyArtifactsController = makeController(
  organizationUserReadManyArtifactsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginate(
      c,
      c.get('db').artifact,
      await ownerArtifactsQuery(c),
    );
    return respond.ok(await shapeAccessibleArtifacts(c, data), { pagination });
  },
);
