/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/queries/ownerArtifactsQuery';
import { organizationReadManyArtifactsRoute } from '#/modules/organization/routes/organizationReadManyArtifacts';

export const organizationReadManyArtifactsController = makeController(
  organizationReadManyArtifactsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifacts(c);
    return respond.ok(data, { pagination });
  },
);
