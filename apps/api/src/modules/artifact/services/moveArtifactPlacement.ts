/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db } from '@template/db';
import type { ArtifactPlacement } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import {
  fetchOwnerRootArtifactOrThrow,
  sameArtifactOwner,
  withLockedArtifacts,
} from '#/modules/artifact/services/artifactOwner';
import {
  fetchArtifactOrThrow,
  validatePlacementTarget,
} from '#/modules/artifact/services/artifactPlacementUtils';
import {
  validateEdgeAuthority,
  validatePlacementDeletable,
} from '#/modules/artifact/validations/validateEdgeAuthority';

export type MoveArtifactPlacementInput = {
  targetContainerArtifactId?: string;
  access?: ArtifactAccess;
};

export const moveArtifactPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
  { targetContainerArtifactId, access }: MoveArtifactPlacementInput,
): Promise<ArtifactPlacement> => {
  const [artifact, sourceContainer] = await Promise.all([
    fetchArtifactOrThrow(placement.artifactId),
    fetchArtifactOrThrow(placement.containerArtifactId),
  ]);
  await validateEdgeAuthority(permix, artifact, sourceContainer, 'remove');
  await validatePlacementDeletable(permix, placement);

  const targetContainer =
    targetContainerArtifactId !== undefined
      ? await fetchArtifactOrThrow(targetContainerArtifactId)
      : await fetchOwnerRootArtifactOrThrow(sourceContainer);
  await validateEdgeAuthority(permix, artifact, targetContainer, 'create', access);
  if (sourceContainer.id === targetContainer.id) {
    throw makeError({ status: 422, message: 'A move needs a different destination' });
  }
  if (!sameArtifactOwner(sourceContainer, targetContainer)) {
    throw makeError({
      status: 422,
      message: 'Cannot move a placement across owners; create a new placement instead',
    });
  }

  return withLockedArtifacts([artifact, sourceContainer, targetContainer], async (locked) => {
    const current = await db.artifactPlacement.findUnique({ where: { id: placement.id } });
    if (!current) {
      throw makeError({ status: 404, message: 'Artifact placement not found' });
    }
    if (current.containerArtifactId !== sourceContainer.id) {
      throw makeError({
        status: 409,
        message: 'Artifact placement changed while waiting for lock; please retry',
      });
    }
    const lockedArtifact = locked.get(current.artifactId)!;
    const lockedSource = locked.get(sourceContainer.id)!;
    const lockedTarget = locked.get(targetContainer.id)!;
    await validateEdgeAuthority(permix, lockedArtifact, lockedSource, 'remove');
    await validatePlacementDeletable(permix, current);
    await validateEdgeAuthority(permix, lockedArtifact, lockedTarget, 'create', access);
    const resolvedAccess = await validatePlacementTarget(lockedArtifact, lockedTarget, access);
    return db.artifactPlacement.update({
      where: { id: current.id },
      data: { containerArtifactId: lockedTarget.id, access: resolvedAccess },
    });
  });
};
