/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db } from '@template/db';
import type { ArtifactPlacement } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import {
  fetchArtifactOrThrow,
  withLockedPlacement,
} from '#/modules/artifact/services/artifactPlacementUtils';
import {
  type PlacementAccessInput,
  validatePlacementAccess,
} from '#/modules/artifact/validations/validatePlacementAccess';
import { validatePlacementPermissions } from '#/modules/artifact/validations/validatePlacementPermissions';

export const updateArtifactPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
  access: PlacementAccessInput,
): Promise<ArtifactPlacement> => {
  const [artifact, container] = await Promise.all([
    fetchArtifactOrThrow(placement.artifactId),
    fetchArtifactOrThrow(placement.containerArtifactId),
  ]);
  await validatePlacementPermissions(permix, artifact, container, 'manage');
  validatePlacementAccess(container, access);

  return withLockedPlacement(
    placement,
    artifact,
    container,
    [],
    async ({ current, lockedArtifact, lockedContainer }) => {
      await validatePlacementPermissions(permix, lockedArtifact, lockedContainer, 'manage');
      return db.artifactPlacement.update({
        where: { id: current.id },
        data: {
          ...(access.readAccess !== undefined ? { readAccess: access.readAccess } : {}),
          ...(access.operateAccess !== undefined ? { operateAccess: access.operateAccess } : {}),
        },
      });
    },
  );
};
