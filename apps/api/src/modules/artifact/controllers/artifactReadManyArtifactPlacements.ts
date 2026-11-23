/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactReadManyArtifactPlacementsRoute } from '#/modules/artifact/routes/artifactReadManyArtifactPlacements';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';

export const artifactReadManyArtifactPlacementsController = makeController(
  artifactReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = contextResource<'artifact'>(c);
    const edges = await db.artifactPlacement.findMany({ where: { artifactId: artifact.id } });
    const containerIds = [...new Set(edges.map((edge) => edge.containerArtifactId))];
    const containers =
      containerIds.length > 0
        ? await db.artifact.findMany({ where: { id: { in: containerIds } } })
        : [];
    const visibleContainerIds = new Set(
      (await listableArtifacts(c.get('permix'), containers)).map((container) => container.id),
    );
    return respond.ok(edges.filter((edge) => visibleContainerIds.has(edge.containerArtifactId)));
  },
);
