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
import {
  fetchOwnerRootArtifactOrThrow,
  sameArtifactOwner,
} from '#/modules/artifact/services/artifactOwner';
import {
  fetchArtifactOrThrow,
  validatePlacementTarget,
  withLockedPlacement,
} from '#/modules/artifact/services/artifactPlacementUtils';
import type { PlacementAccessInput } from '#/modules/artifact/validations/validatePlacementAccess';
import {
  validatePlacementDeletable,
  validatePlacementPermissions,
} from '#/modules/artifact/validations/validatePlacementPermissions';

type MoveArtifactPlacementInput = PlacementAccessInput & {
  targetContainerArtifactId?: string;
};

export const moveArtifactPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
  { targetContainerArtifactId, readAccess, operateAccess }: MoveArtifactPlacementInput,
): Promise<ArtifactPlacement> => {
  const access: PlacementAccessInput = { readAccess, operateAccess };
  const [artifact, sourceContainer] = await Promise.all([
    fetchArtifactOrThrow(placement.artifactId),
    fetchArtifactOrThrow(placement.containerArtifactId),
  ]);
  await validatePlacementPermissions(permix, artifact, sourceContainer, 'delete');
  await validatePlacementDeletable(permix, placement);

  const targetContainer =
    targetContainerArtifactId !== undefined
      ? await fetchArtifactOrThrow(targetContainerArtifactId)
      : await fetchOwnerRootArtifactOrThrow(sourceContainer);
  await validatePlacementPermissions(permix, artifact, targetContainer, 'create', access);
  if (sourceContainer.id === targetContainer.id) {
    throw makeError({ status: 422, message: 'A move needs a different destination' });
  }
  if (!sameArtifactOwner(sourceContainer, targetContainer)) {
    throw makeError({
      status: 422,
      message: 'Cannot move a placement across owners; create a new placement instead',
    });
  }

  return withLockedPlacement(
    placement,
    artifact,
    sourceContainer,
    [targetContainer],
    async ({ current, lockedArtifact, lockedContainer: lockedSource, locked }) => {
      const lockedTarget = locked.get(targetContainer.id)!;
      await validatePlacementPermissions(permix, lockedArtifact, lockedSource, 'delete');
      await validatePlacementDeletable(permix, current);
      await validatePlacementPermissions(permix, lockedArtifact, lockedTarget, 'create', access);
      const resolvedAccess = await validatePlacementTarget(lockedArtifact, lockedTarget, access);
      return db.artifactPlacement.update({
        where: { id: current.id },
        data: { containerArtifactId: lockedTarget.id, ...resolvedAccess },
      });
    },
  );
};
