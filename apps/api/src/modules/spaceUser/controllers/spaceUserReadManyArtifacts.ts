/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/queries/ownerArtifactsQuery';
import { spaceUserReadManyArtifactsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyArtifacts';

export const spaceUserReadManyArtifactsController = makeController(
  spaceUserReadManyArtifactsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifacts(c);
    return respond.ok(data, { pagination });
  },
);
