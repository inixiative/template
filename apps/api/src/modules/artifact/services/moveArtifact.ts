/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { sameArtifactOwner, withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import {
  fetchArtifactOrThrow,
  writePlacement,
} from '#/modules/artifact/services/artifactPlacementUtils';
import {
  ensureOwnerRootArtifact,
  fetchOwnerRootArtifact,
} from '#/modules/artifact/services/ownerRootArtifact';
import { validateArtifactPermission } from '#/modules/artifact/validations/validateArtifactPermission';
import {
  validateEdgeAuthority,
  validatePlacementDeletable,
} from '#/modules/artifact/validations/validateEdgeAuthority';
import { validateNotRootArtifact } from '#/modules/artifact/validations/validateNotRootArtifact';

export type MoveArtifactInput = {
  artifactId: string;
  sourceContainerArtifactId?: string;
  targetContainerArtifactId?: string;
  access?: ArtifactAccess;
};

const fetchAuthorizedSourcePlacement = async (
  permix: Permix,
  artifact: Artifact,
  sourceContainer: Artifact,
): Promise<ArtifactPlacement> => {
  await validateEdgeAuthority(permix, artifact, sourceContainer, 'remove');
  const edge = await db.artifactPlacement.findFirst({
    where: { artifactId: artifact.id, containerArtifactId: sourceContainer.id },
  });
  if (!edge) {
    if (
      !sameArtifactOwner(artifact, sourceContainer) &&
      !(await holdsOnRecord(permix, 'artifact', artifact, 'read'))
    ) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
    throw makeError({ status: 404, message: 'The artifact is not in that container' });
  }
  await validatePlacementDeletable(permix, edge);
  return edge;
};

const validateMovePair = (
  artifact: Artifact,
  sourceContainer: Artifact,
  targetContainer: Artifact,
) => {
  if (sourceContainer.id === targetContainer.id) {
    throw makeError({ status: 422, message: 'A move needs a different destination' });
  }
  if (
    sameArtifactOwner(artifact, sourceContainer) &&
    !sameArtifactOwner(artifact, targetContainer)
  ) {
    throw makeError({
      status: 422,
      message:
        'Cannot move an artifact out of its own workspace into another owner; use place or transfer instead',
    });
  }
};

export const moveArtifact = async (
  permix: Permix,
  { artifactId, sourceContainerArtifactId, targetContainerArtifactId, access }: MoveArtifactInput,
): Promise<Artifact> => {
  const artifact = await fetchArtifactOrThrow(artifactId);
  validateNotRootArtifact(artifact, 'Root container cannot be moved');

  if (!sourceContainerArtifactId && !targetContainerArtifactId) {
    await validateArtifactPermission(permix, artifact, 'manage');
    throw makeError({ status: 422, message: 'A move needs a different destination' });
  }

  // Gate container lookups when the caller cannot even read the artifact (prevents container existence oracle).
  if (
    !(await holdsOnRecord(permix, 'artifact', artifact, 'read')) &&
    (!sourceContainerArtifactId ||
      !(await holdsOnRecord(
        permix,
        'artifact',
        await fetchArtifactOrThrow(sourceContainerArtifactId),
        'operate',
      )))
  ) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }

  const sourceContainer = sourceContainerArtifactId
    ? await fetchArtifactOrThrow(sourceContainerArtifactId)
    : await fetchOwnerRootArtifact(artifact);
  if (!sourceContainer) {
    await validateArtifactPermission(permix, artifact, 'manage');
    throw makeError({ status: 404, message: 'The artifact is not in that container' });
  }

  const targetContainer = targetContainerArtifactId
    ? await fetchArtifactOrThrow(targetContainerArtifactId)
    : await ensureOwnerRootArtifact(artifact);

  await fetchAuthorizedSourcePlacement(permix, artifact, sourceContainer);
  await validateEdgeAuthority(permix, artifact, targetContainer, 'create', access);
  validateMovePair(artifact, sourceContainer, targetContainer);

  return withLockedArtifacts([artifact, sourceContainer, targetContainer], async (locked) => {
    const lockedArtifact = locked.get(artifactId)!;
    const lockedSource = locked.get(sourceContainer.id)!;
    const lockedTarget = locked.get(targetContainer.id)!;
    validateNotRootArtifact(lockedArtifact, 'Root container cannot be moved');
    const sourceEdge = await fetchAuthorizedSourcePlacement(permix, lockedArtifact, lockedSource);
    await validateEdgeAuthority(permix, lockedArtifact, lockedTarget, 'create', access);
    validateMovePair(lockedArtifact, lockedSource, lockedTarget);
    await writePlacement(lockedArtifact, lockedTarget, access);
    await db.artifactPlacement.update({
      where: { id: sourceEdge.id },
      data: { deletedAt: new Date() },
    });
    return db.artifact.findUniqueOrThrow({ where: { id: artifactId } });
  });
};
