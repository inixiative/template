/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { db } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { creatorGrantFor } from '#/modules/artifact/lib/creatorGrant';
import { artifactCopyRoute } from '#/modules/artifact/routes/artifactCopy';
import { copyArtifact } from '#/modules/artifact/services/artifactPlacements';

export const artifactCopyController = makeController(artifactCopyRoute, async (c, respond) => {
  const { containerArtifactId, name } = c.req.valid('json');
  const container = await db.artifact.findUniqueOrThrow({ where: { id: containerArtifactId } });
  const copy = await copyArtifact(artifactActorFromContext(c), {
    artifactId: getResource<'artifact'>(c).id,
    containerArtifactId,
    name,
    creatorGrant: creatorGrantFor(c, container),
  });
  return respond.ok(copy);
});
