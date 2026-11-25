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
import {
  assertEdgeAuthority,
  assertPlacementAccessValid,
  fetchArtifact,
} from '#/modules/artifact/services/artifactPlacementHelpers';

export const updateArtifactPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
  { access }: { access: ArtifactAccess },
): Promise<ArtifactPlacement> => {
  const member = await fetchArtifact(placement.artifactId);
  const container = await fetchArtifact(placement.containerArtifactId);
  await assertEdgeAuthority(permix, member, container, 'manage');
  assertPlacementAccessValid(container, access);

  return withLockedArtifacts([member, container], async (locked) => {
    const current = await db.artifactPlacement.findUnique({ where: { id: placement.id } });
    if (!current) {
      throw makeError({ status: 404, message: 'Artifact placement not found' });
    }
    const lockedMember = locked.get(current.artifactId)!;
    const lockedContainer = locked.get(current.containerArtifactId)!;
    await assertEdgeAuthority(permix, lockedMember, lockedContainer, 'manage');
    assertPlacementAccessValid(lockedContainer, access);
    return db.artifactPlacement.update({
      where: { id: current.id },
      data: { access },
    });
  });
};
