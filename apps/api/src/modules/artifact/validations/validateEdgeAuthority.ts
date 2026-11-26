/**
 * @atlas
 * @kind validation
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import { type ArtifactAccess, ArtifactKind } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { isRootKind } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';
import { validateArtifactCreateAtOwner } from '#/modules/artifact/validations/validateArtifactCreateAtOwner';
import { validateArtifactPermission } from '#/modules/artifact/validations/validateArtifactPermission';
import { defaultPlacementAccess } from '#/modules/artifact/validations/validatePlacementAccess';

export const validateEdgeAuthority = async (
  permix: Permix,
  artifact: Artifact,
  container: Artifact,
  mode: 'create' | 'remove' | 'manage',
  access?: ArtifactAccess,
): Promise<void> => {
  const isCustomAccess =
    mode === 'create' && access !== undefined && access !== defaultPlacementAccess(container);
  if (mode === 'create' && isRootKind(container.kind)) {
    await validateArtifactCreateAtOwner(permix, ArtifactKind.root, container);
  }
  const containerAction = mode === 'manage' || isCustomAccess ? 'manage' : 'operate';
  await validateArtifactPermission(permix, container, containerAction);
  const sameOwner = sameArtifactOwner(artifact, container);
  if (!sameOwner && mode === 'remove') return;
  await validateArtifactPermission(permix, artifact, sameOwner ? 'manage' : 'read');
};

export const validatePlacementDeletable = async (
  permix: Permix,
  placement: ArtifactPlacement,
): Promise<void> => {
  if (!(await holdsOnRecord(permix, 'artifactPlacement', placement, 'delete'))) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
};
