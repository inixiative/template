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
import { withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import { fetchArtifactOrThrow } from '#/modules/artifact/services/artifactPlacementUtils';
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

  return withLockedArtifacts([artifact, container], async (locked) => {
    const current = await db.artifactPlacement.findUnique({ where: { id: placement.id } });
    if (!current) {
      throw makeError({ status: 404, message: 'Artifact placement not found' });
    }
    const lockedArtifact = locked.get(current.artifactId)!;
    const lockedContainer = locked.get(current.containerArtifactId)!;
    await validateEdgeAuthority(permix, lockedArtifact, lockedContainer, 'manage');
    return db.artifactPlacement.update({
      where: { id: current.id },
      data: { access },
    });
  });
};
