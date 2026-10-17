/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactReadManyArtifactContainersRoute } from '#/modules/artifact/routes/artifactReadManyArtifactContainers';

export const artifactReadManyArtifactContainersController = makeController(
  artifactReadManyArtifactContainersRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = getResource<'artifact'>(c);
    const edges = await db.artifactContainer.findMany({ where: { artifactId: artifact.id } });
    return respond.ok(edges);
  },
);
