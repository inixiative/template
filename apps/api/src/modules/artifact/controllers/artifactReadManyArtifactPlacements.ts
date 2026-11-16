/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactReadManyArtifactPlacementsRoute } from '#/modules/artifact/routes/artifactReadManyArtifactPlacements';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export const artifactReadManyArtifactPlacementsController = makeController(
  artifactReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = getResource<'artifact'>(c);
    const edges = await db.artifactPlacement.findMany({ where: { artifactId: artifact.id } });
    const verdicts = await checkArtifactAccess(
      artifactActorFromContext(c),
      edges.map((edge) => edge.containerArtifactId),
      'read',
    );
    return respond.ok(edges.filter((edge) => verdicts.get(edge.containerArtifactId)?.listed));
  },
);
