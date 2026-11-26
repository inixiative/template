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
import { ownerColumns, sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';
import {
  fetchArtifactOrThrow,
  withLockedPlacement,
} from '#/modules/artifact/services/artifactPlacementUtils';
import {
  validatePlacementDeletable,
  validatePlacementPermissions,
} from '#/modules/artifact/validations/validatePlacementPermissions';

export const deleteArtifactPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
): Promise<void> => {
  const [artifact, container] = await Promise.all([
    fetchArtifactOrThrow(placement.artifactId),
    fetchArtifactOrThrow(placement.containerArtifactId),
  ]);
  await validatePlacementPermissions(permix, artifact, container, 'delete');
  await withLockedPlacement(
    placement,
    artifact,
    container,
    [],
    async ({ current, lockedArtifact, lockedContainer }) => {
      await validatePlacementPermissions(permix, lockedArtifact, lockedContainer, 'delete');
      await validatePlacementDeletable(permix, current);

      if (sameArtifactOwner(lockedArtifact, lockedContainer) && isRootKind(lockedContainer.kind)) {
        const otherSameOwnerPlacements = await db.artifactPlacement.count({
          where: {
            id: { not: current.id },
            artifactId: lockedArtifact.id,
            containerArtifact: ownerColumns(lockedArtifact),
          },
        });
        if (otherSameOwnerPlacements === 0) {
          throw makeError({
            status: 422,
            message: 'Cannot remove an artifact from its root unless it sits in another folder',
          });
        }
      }

      await db.artifactPlacement.delete({ where: { id: current.id } });
    },
  );
};
