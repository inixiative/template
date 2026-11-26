/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactCopyRoute } from '#/modules/artifact/routes/artifactCopy';
import { targetOwnerFromBody } from '#/modules/artifact/services/artifactOwner';
import { copyArtifact } from '#/modules/artifact/services/copyArtifact';

export const artifactCopyController = makeController(artifactCopyRoute, async (c, respond) => {
  const body = c.req.valid('json');
  const target =
    body.targetContainerArtifactId !== undefined
      ? { targetContainerArtifactId: body.targetContainerArtifactId }
      : { owner: targetOwnerFromBody(body, c) };
  const copy = await copyArtifact(c.get('permix'), {
    source: contextResource<'artifact'>(c),
    ...target,
    name: body.name,
  });
  return respond.ok(copy);
});
