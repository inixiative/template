/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { parentsWithRootAsTop } from '#/modules/artifact/lib/rootAsTop';
import { artifactReadParentsRoute } from '#/modules/artifact/routes/artifactReadParents';
import { readableArtifacts } from '#/modules/artifact/services/readableArtifacts';

export const artifactReadParentsController = makeController(
  artifactReadParentsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = getResource<'artifact'>(c);
    const parents = await db.artifact.findMany({
      where: { members: { some: { artifactId: artifact.id } } },
      orderBy: { name: 'asc' },
    });
    const shown = parentsWithRootAsTop(artifact, parents);
    return respond.ok(await readableArtifacts(artifactActorFromContext(c), shown));
  },
);
