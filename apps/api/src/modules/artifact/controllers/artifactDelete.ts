/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactDeleteRoute } from '#/modules/artifact/routes/artifactDelete';
import { withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import { validateArtifactPermission } from '#/modules/artifact/validations/validateArtifactPermission';
import { validateNotRootArtifact } from '#/modules/artifact/validations/validateNotRootArtifact';

export const artifactDeleteController = makeController(artifactDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const artifact = contextResource<'artifact'>(c);
  validateNotRootArtifact(artifact, 'Root container cannot be deleted');
  await withLockedArtifacts([artifact], async (locked) => {
    const target = locked.get(artifact.id)!;
    validateNotRootArtifact(target, 'Root container cannot be deleted');
    await validateArtifactPermission(permix, target, 'delete');
    await db.artifact.update({ where: { id: target.id }, data: { deletedAt: new Date() } });
  });
  return respond.noContent();
});
