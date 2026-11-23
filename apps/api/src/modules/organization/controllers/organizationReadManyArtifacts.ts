/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { fetchRootArtifacts } from '#/modules/artifact/services/fetchRootArtifacts';
import { organizationReadManyArtifactsRoute } from '#/modules/organization/routes/organizationReadManyArtifacts';

export const organizationReadManyArtifactsController = makeController(
  organizationReadManyArtifactsRoute,
  async (c, respond) => {
    const roots = await fetchRootArtifacts(artifactActorFromContext(c), {
      ownerModel: 'Organization',
      organizationId: contextResource<'organization'>(c).id,
    });
    return respond.ok(roots);
  },
);
