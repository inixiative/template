/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { isContainerKind } from '@template/shared/artifact';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { artifactDeleteRoute } from '#/modules/artifact/routes/artifactDelete';
import { ownerColumns, withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import { reparentOrphanedOwnedArtifacts } from '#/modules/artifact/services/artifactPlacementHelpers';
import { canActOnArtifact } from '#/modules/artifact/services/checkArtifactPermission';
import { assertNotRootArtifact } from '#/modules/artifact/services/ownerRootArtifact';

export const artifactDeleteController = makeController(artifactDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const artifact = contextResource<'artifact'>(c);
  assertNotRootArtifact(artifact, 'Root container cannot be deleted');
  await withLockedArtifacts([artifact], async (locked) => {
    const target = locked.get(artifact.id)!;
    assertNotRootArtifact(target, 'Root container cannot be deleted');
    if (!(await canActOnArtifact(permix, target, 'delete'))) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
    const ownedChildIds = isContainerKind(target.kind)
      ? (
          await db.artifactPlacement.findMany({
            where: {
              containerArtifactId: target.id,
              artifact: ownerColumns(target),
            },
            select: { artifactId: true },
          })
        ).map((row) => row.artifactId)
      : [];
    await db.artifact.update({ where: { id: target.id }, data: { deletedAt: new Date() } });
    if (ownedChildIds.length > 0) {
      await reparentOrphanedOwnedArtifacts(target, ownedChildIds);
    }
  });
  return respond.noContent();
});
