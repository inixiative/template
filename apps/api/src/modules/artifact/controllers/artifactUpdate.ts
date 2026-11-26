/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactUpdateRoute } from '#/modules/artifact/routes/artifactUpdate';
import { withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import { validateNotRootArtifact } from '#/modules/artifact/validations/validateNotRootArtifact';

export const artifactUpdateController = makeController(artifactUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const artifact = contextResource<'artifact'>(c);
  validateNotRootArtifact(artifact, 'Root container cannot be updated');
  const data = c.req.valid('json');
  const updated = await withLockedArtifacts([artifact], async (locked) => {
    const target = locked.get(artifact.id)!;
    return db.artifact.update({ where: { id: target.id }, data });
  });
  return respond.ok(updated);
});
