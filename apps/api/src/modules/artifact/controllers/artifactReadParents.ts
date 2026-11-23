/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactReadParentsRoute } from '#/modules/artifact/routes/artifactReadParents';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';

export const artifactReadParentsController = makeController(
  artifactReadParentsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = contextResource<'artifact'>(c);
    const parents = await db.artifact.findMany({
      where: { contents: { some: { artifactId: artifact.id } } },
      orderBy: { name: 'asc' },
    });
    return respond.ok(await listableArtifacts(c.get('permix'), parents));
  },
);
