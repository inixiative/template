/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { isOwnerRootKind } from '@template/shared/artifact';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { artifactUpdateRoute } from '#/modules/artifact/routes/artifactUpdate';

export const artifactUpdateController = makeController(artifactUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const artifact = getResource<'artifact'>(c);
  if (isOwnerRootKind(artifact.kind)) {
    throw makeError({ status: 422, message: "An owner's root can't be changed" });
  }
  const updated = await db.artifact.update({
    where: { id: artifact.id },
    data: c.req.valid('json'),
  });
  return respond.ok(updated);
});
