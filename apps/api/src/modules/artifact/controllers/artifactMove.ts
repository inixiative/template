/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactMoveRoute } from '#/modules/artifact/routes/artifactMove';
import { moveArtifact } from '#/modules/artifact/services/artifactPlacements';

export const artifactMoveController = makeController(artifactMoveRoute, async (c, respond) => {
  const moved = await moveArtifact(artifactActorFromContext(c), {
    artifactId: contextResource<'artifact'>(c).id,
    ...c.req.valid('json'),
  });
  return respond.ok(moved);
});
