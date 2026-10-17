/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactCreateArtifactContainerRoute } from '#/modules/artifact/routes/artifactCreateArtifactContainer';
import { addArtifactToContainer } from '#/modules/artifact/services/addArtifactToContainer';

export const artifactCreateArtifactContainerController = makeController(
  artifactCreateArtifactContainerRoute,
  async (c, respond) => {
    const artifact = getResource<'artifact'>(c);
    const { containerArtifactId, inherit } = c.req.valid('json');
    const edge = await addArtifactToContainer(artifactActorFromContext(c), {
      artifactId: artifact.id,
      containerArtifactId,
      inherit,
    });
    return respond.created(edge);
  },
);
