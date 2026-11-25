/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db } from '@template/db';
import type { ArtifactPlacement } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { withLockedArtifacts } from '#/modules/artifact/lib/artifactOwner';
import {
  assertEdgeAuthority,
  fetchArtifact,
} from '#/modules/artifact/lib/artifactPlacementHelpers';

export const removeArtifactPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
): Promise<void> => {
  const member = await fetchArtifact(placement.artifactId);
  const container = await fetchArtifact(placement.containerArtifactId);
  await assertEdgeAuthority(permix, member, container, 'remove');
  await withLockedArtifacts([member, container], async (locked) => {
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
  });
};
