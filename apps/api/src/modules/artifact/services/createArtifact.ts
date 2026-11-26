/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import type { Prisma } from '@template/db';
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
  fetchArtifactOrThrow,
  insertArtifact,
} from '#/modules/artifact/services/artifactPlacementUtils';
import { validateArtifactPermission } from '#/modules/artifact/validations/validateArtifactPermission';
import {
  isCustomPlacementAccess,
  type PlacementAccessInput,
  resolvePlacementAccess,
  validatePlacementAccess,
} from '#/modules/artifact/validations/validatePlacementAccess';

type CreateArtifactInput = Omit<
  Prisma.ArtifactUncheckedCreateInput,
  'effectiveReadAccess' | 'effectiveOperateAccess'
> &
  PlacementAccessInput & {
    containerArtifactId?: string;
  };

export const createArtifact = async (
  permix: Permix,
  { containerArtifactId, readAccess, operateAccess, ...data }: CreateArtifactInput,
): Promise<Artifact> => {
  const ownerFields = ownerColumns(data);
  const container = containerArtifactId
    ? await fetchArtifactOrThrow(containerArtifactId)
    : await fetchOwnerRootArtifactOrThrow(ownerFields);
  const accessInput: PlacementAccessInput = { readAccess, operateAccess };
  const resolvedAccess = resolvePlacementAccess(container, accessInput);
  const containerAction = isCustomPlacementAccess(container, accessInput) ? 'manage' : 'operate';
  const checkContainer = Boolean(containerArtifactId) || containerAction === 'manage';

  if (checkContainer) await validateArtifactPermission(permix, container, containerAction);
  if (containerArtifactId && !sameArtifactOwner(container, ownerFields)) {
    throw makeError({
      status: 422,
      message: 'Cannot create an artifact directly inside another owner container',
    });
  }
  validatePlacementAccess(container, resolvedAccess);

  return withLockedArtifacts([container], async (locked) => {
    const lockedContainer = locked.get(container.id)!;
    if (checkContainer) await validateArtifactPermission(permix, lockedContainer, containerAction);
    return insertArtifact(data, lockedContainer, resolvedAccess);
  });
};
