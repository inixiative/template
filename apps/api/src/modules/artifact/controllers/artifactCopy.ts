/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { creatorGrantFor } from '#/modules/artifact/lib/creatorGrant';
import { artifactCopyRoute } from '#/modules/artifact/routes/artifactCopy';
import { copyArtifact } from '#/modules/artifact/services/artifactPlacements';

export const artifactCopyController = makeController(artifactCopyRoute, async (c, respond) => {
  const { containerArtifactId, name } = c.req.valid('json');
  const copy = await copyArtifact(artifactActorFromContext(c), {
    artifactId: contextResource<'artifact'>(c).id,
    containerArtifactId,
    name,
    creatorGrant: (container) => creatorGrantFor(c, container),
  });
  return respond.ok(copy);
});
