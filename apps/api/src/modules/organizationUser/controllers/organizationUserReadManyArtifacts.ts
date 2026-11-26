/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/queries/ownerArtifactsQuery';
import { organizationUserReadManyArtifactsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifacts';

export const organizationUserReadManyArtifactsController = makeController(
  organizationUserReadManyArtifactsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifacts(c);
    return respond.ok(data, { pagination });
  },
);
