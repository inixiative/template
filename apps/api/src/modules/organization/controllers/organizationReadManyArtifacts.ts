/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { listRootArtifacts } from '#/modules/artifact/services/listRootArtifacts';
import { organizationReadManyArtifactsRoute } from '#/modules/organization/routes/organizationReadManyArtifacts';

export const organizationReadManyArtifactsController = makeController(
  organizationReadManyArtifactsRoute,
  async (c, respond) => {
    const roots = await listRootArtifacts(artifactActorFromContext(c), {
      ownerModel: 'Organization',
      organizationId: getResource<'organization'>(c).id,
    });
    return respond.ok(roots);
  },
);
