/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db } from '@template/db';
import type { ArtifactPlacement } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { isRootKind } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import {
  ownerColumns,
  sameArtifactOwner,
  withLockedArtifacts,
} from '#/modules/artifact/services/artifactOwner';
import {
  assertEdgeAuthority,
  assertPlacementDeletable,
  fetchArtifact,
  reparentOrphanedOwnedArtifacts,
} from '#/modules/artifact/services/artifactPlacementHelpers';

export const removeArtifactPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
): Promise<void> => {
  const member = await fetchArtifact(placement.artifactId);
  const container = await fetchArtifact(placement.containerArtifactId);
  await assertEdgeAuthority(permix, member, container, 'remove');
  await assertPlacementDeletable(permix, placement);
  await withLockedArtifacts([member, container], async (locked) => {
    const current = await db.artifactPlacement.findUnique({ where: { id: placement.id } });
    if (!current) {
      throw makeError({ status: 404, message: 'The artifact is not in that container' });
    }
    const lockedMember = locked.get(current.artifactId)!;
    const lockedContainer = locked.get(current.containerArtifactId)!;
    await assertEdgeAuthority(permix, lockedMember, lockedContainer, 'remove');
    await assertPlacementDeletable(permix, current);

    const sameOwner = sameArtifactOwner(lockedMember, lockedContainer);
    if (sameOwner && isRootKind(lockedContainer.kind)) {
      const otherSameOwnerPlacements = await db.artifactPlacement.count({
        where: {
          id: { not: current.id },
          artifactId: lockedMember.id,
          containerArtifact: ownerColumns(lockedMember),
        },
      });
      if (otherSameOwnerPlacements === 0) {
        throw makeError({
          status: 422,
          message: 'Cannot remove an artifact from its root unless it sits in another folder',
        });
      }
    }

    await db.artifactPlacement.update({
      where: { id: current.id },
      data: { deletedAt: new Date() },
    });
    if (sameOwner && !isRootKind(lockedContainer.kind)) {
      await reparentOrphanedOwnedArtifacts(lockedMember, [lockedMember.id]);
    }
  });
};
