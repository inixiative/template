/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactCopyRoute } from '#/modules/artifact/routes/artifactCopy';
import { copyArtifact } from '#/modules/artifact/services/copyArtifact';

export const artifactCopyController = makeController(artifactCopyRoute, async (c, respond) => {
  const { targetContainerArtifactId, name } = c.req.valid('json');
  const copy = await copyArtifact(c.get('permix'), {
    source: contextResource<'artifact'>(c),
    targetContainerArtifactId,
    name,
  });
  return respond.ok(copy);
});
