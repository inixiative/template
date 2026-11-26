/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import type { Artifact } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import {
  fetchOwnerRootArtifactOrThrow,
  ownerColumns,
  sameArtifactOwner,
  withLockedArtifacts,
} from '#/modules/artifact/services/artifactOwner';
import {
  type CreateArtifactInput,
  fetchArtifactOrThrow,
  insertArtifact,
} from '#/modules/artifact/services/artifactPlacementUtils';
import { validateArtifactPermission } from '#/modules/artifact/validations/validateArtifactPermission';
import {
  defaultPlacementAccess,
  validatePlacementAccess,
} from '#/modules/artifact/validations/validatePlacementAccess';

export type { CreateArtifactInput };

export const createArtifact = async (
  permix: Permix,
  { containerArtifactId, access, ...data }: CreateArtifactInput,
): Promise<Artifact> => {
  const ownerFields = ownerColumns(data);
  const container = containerArtifactId
    ? await fetchArtifactOrThrow(containerArtifactId)
    : await fetchOwnerRootArtifactOrThrow(ownerFields);
  const resolvedAccess = access ?? defaultPlacementAccess(container);
  const containerAction =
    resolvedAccess !== defaultPlacementAccess(container) ? 'manage' : 'operate';

  if (containerArtifactId) {
    await validateArtifactPermission(permix, container, containerAction);
    if (!sameArtifactOwner(container, ownerFields)) {
      throw makeError({
        status: 422,
        message: 'Cannot create an artifact directly inside another owner container',
      });
    }
    validatePlacementAccess(container, resolvedAccess);
  } else {
    validatePlacementAccess(container, resolvedAccess);
    if (containerAction === 'manage') {
      await validateArtifactPermission(permix, container, 'manage');
    }
  }

  return withLockedArtifacts([container], async (locked) => {
    const lockedContainer = locked.get(container.id)!;
    if (containerArtifactId || containerAction === 'manage') {
      await validateArtifactPermission(permix, lockedContainer, containerAction);
    }
    return insertArtifact(data, lockedContainer, resolvedAccess);
  });
};
