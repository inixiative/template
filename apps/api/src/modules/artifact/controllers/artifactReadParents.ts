/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactReadParentsRoute } from '#/modules/artifact/routes/artifactReadParents';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';

export const artifactReadParentsController = makeController(
  artifactReadParentsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = getResource<'artifact'>(c);
    const parents = await db.artifact.findMany({
      where: { contents: { some: { artifactId: artifact.id } } },
      orderBy: { name: 'asc' },
    });
    return respond.ok(await listableArtifacts(artifactActorFromContext(c), parents));
  },
);
