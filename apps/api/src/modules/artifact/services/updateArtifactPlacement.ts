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
import {
  fetchArtifactOrThrow,
  withLockedPlacement,
} from '#/modules/artifact/services/artifactPlacementUtils';
import { validateEdgeAuthority } from '#/modules/artifact/validations/validateEdgeAuthority';
import { validatePlacementAccess } from '#/modules/artifact/validations/validatePlacementAccess';

export const updateArtifactPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
  { access }: { access: ArtifactAccess },
): Promise<ArtifactPlacement> => {
  const [artifact, container] = await Promise.all([
    fetchArtifactOrThrow(placement.artifactId),
    fetchArtifactOrThrow(placement.containerArtifactId),
  ]);
  await validateEdgeAuthority(permix, artifact, container, 'manage');
  validatePlacementAccess(container, access);

  return withLockedPlacement(
    placement,
    artifact,
    container,
    [],
    async ({ current, lockedArtifact, lockedContainer }) => {
      await validateEdgeAuthority(permix, lockedArtifact, lockedContainer, 'manage');
      return db.artifactPlacement.update({ where: { id: current.id }, data: { access } });
    },
  );
};
