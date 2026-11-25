/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import type { ArtifactPlacement } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import {
  assertEdgeAuthority,
  fetchArtifact,
  writePlacement,
} from '#/modules/artifact/services/artifactPlacementHelpers';

export type PlaceArtifactInput = {
  artifactId: string;
  containerArtifactId: string;
  inherit?: boolean;
};

export const placeArtifact = async (
  permix: Permix,
  { artifactId, containerArtifactId, inherit }: PlaceArtifactInput,
): Promise<ArtifactPlacement> => {
  const member = await fetchArtifact(artifactId);
  const container = await fetchArtifact(containerArtifactId);
  await assertEdgeAuthority(permix, member, container, 'create');
  return withLockedArtifacts([member, container], async (locked) => {
    const lockedMember = locked.get(artifactId)!;
    const lockedContainer = locked.get(containerArtifactId)!;
    await assertEdgeAuthority(permix, lockedMember, lockedContainer, 'create');
    return writePlacement(lockedMember, lockedContainer, inherit);
  });
};
