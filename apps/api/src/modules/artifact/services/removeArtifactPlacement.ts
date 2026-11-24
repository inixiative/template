/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { withArtifactOwnersLock } from '#/modules/artifact/lib/artifactOwner';
import { assertEdgeAuthority } from '#/modules/artifact/lib/assertEdgeAuthority';

export const removeArtifactPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
): Promise<void> => {
  const member = await db.artifact.findUniqueOrThrow({ where: { id: placement.artifactId } });
  const container = await db.artifact.findUniqueOrThrow({
    where: { id: placement.containerArtifactId },
  });
  await assertEdgeAuthority(permix, member, container, 'remove');
  await withArtifactOwnersLock([member, container], () =>
    db.txn(async () => {
      const locked = new Map<string, Artifact>();
      for (const id of [...new Set([placement.artifactId, placement.containerArtifactId])].sort()) {
        const [row] = await db.findForUpdate<Artifact>('Artifact', { id });
        if (!row || row.deletedAt) {
          throw makeError({ status: 404, message: 'Artifact not found' });
        }
        locked.set(id, row);
      }
      const current = await db.artifactPlacement.findUnique({ where: { id: placement.id } });
      if (!current) {
        throw makeError({ status: 404, message: 'The artifact is not in that container' });
      }
      await assertEdgeAuthority(
        permix,
        locked.get(current.artifactId)!,
        locked.get(current.containerArtifactId)!,
        'remove',
      );
      await db.artifactPlacement.update({
        where: { id: current.id },
        data: { deletedAt: new Date() },
      });
    }),
  );
};
