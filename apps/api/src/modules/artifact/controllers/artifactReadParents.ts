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
import { readableArtifacts } from '#/modules/artifact/services/readableArtifacts';

export const artifactReadParentsController = makeController(
  artifactReadParentsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const parents = await db.artifact.findMany({
      where: { members: { some: { artifactId: getResource<'artifact'>(c).id } } },
      orderBy: { name: 'asc' },
    });
    return respond.ok(await readableArtifacts(artifactActorFromContext(c), parents));
  },
);
