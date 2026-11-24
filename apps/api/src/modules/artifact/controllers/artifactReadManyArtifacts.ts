/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactReadManyArtifactsRoute } from '#/modules/artifact/routes/artifactReadManyArtifacts';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';

export const artifactReadManyArtifactsController = makeController(
  artifactReadManyArtifactsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const container = contextResource<'artifact'>(c);
    const exclusive = c.req.valid('query').exclusive === 'true';
    const members = await db.artifact.findMany({
      where: {
        placements: exclusive
          ? {
              some: { containerArtifactId: container.id },
              every: { containerArtifactId: container.id },
            }
          : { some: { containerArtifactId: container.id } },
      },
      orderBy: { name: 'asc' },
    });
    return respond.ok(await listableArtifacts(c.get('permix'), members));
  },
);
