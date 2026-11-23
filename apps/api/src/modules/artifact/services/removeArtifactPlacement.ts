/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { artifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { assertEdgeAuthority } from '#/modules/artifact/lib/assertEdgeAuthority';
import { assertKeepsMemberScope } from '#/modules/artifact/services/assertKeepsMemberScope';

export const removeArtifactPlacement = async (
  actor: ArtifactActor,
  placement: ArtifactPlacement,
): Promise<void> => {
  await assertEdgeAuthority(actor, placement.artifactId, placement.containerArtifactId);
  const member = await db.artifact.findUniqueOrThrow({ where: { id: placement.artifactId } });
  await withOwnerLock(artifactOwner(member), 'containers', () =>
    db.txn(async () => {
      for (const id of [...new Set([placement.artifactId, placement.containerArtifactId])].sort()) {
        const [locked] = await db.findForUpdate<Artifact>('Artifact', { id });
        if (!locked || locked.deletedAt) {
          throw makeError({ status: 404, message: 'Artifact not found' });
        }
      }
      const current = await db.artifactPlacement.findUnique({ where: { id: placement.id } });
      if (!current) {
        throw makeError({ status: 404, message: 'The artifact is not in that container' });
      }
      await assertEdgeAuthority(actor, current.artifactId, current.containerArtifactId);
      await assertKeepsMemberScope([current.artifactId], current.containerArtifactId);
      await db.artifactPlacement.update({
        where: { id: current.id },
        data: { deletedAt: new Date() },
      });
    }),
  );
};
