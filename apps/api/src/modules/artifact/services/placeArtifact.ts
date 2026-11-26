/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import {
  fetchOwnerRootArtifactOrThrow,
  type OwnerRef,
  withLockedArtifacts,
} from '#/modules/artifact/services/artifactOwner';
import {
  fetchArtifactOrThrow,
  writePlacement,
} from '#/modules/artifact/services/artifactPlacementUtils';
import { validateEdgeAuthority } from '#/modules/artifact/validations/validateEdgeAuthority';
import { validateNotRootArtifact } from '#/modules/artifact/validations/validateNotRootArtifact';

export type PlaceArtifactInput =
  | {
      artifact: Artifact;
      containerArtifactId: string;
      access?: ArtifactAccess;
    }
  | {
      artifact: Artifact;
      owner: OwnerRef;
      access?: ArtifactAccess;
    };

export const placeArtifact = async (
  permix: Permix,
  input: PlaceArtifactInput,
): Promise<ArtifactPlacement> => {
  const { artifact, access } = input;
  validateNotRootArtifact(artifact, 'Root container cannot be placed inside another container');
  const container =
    'owner' in input
      ? await fetchOwnerRootArtifactOrThrow(input.owner)
      : await fetchArtifactOrThrow(input.containerArtifactId);

  await validateEdgeAuthority(permix, artifact, container, 'create', access);
  return withLockedArtifacts([artifact, container], async (locked) => {
    const lockedArtifact = locked.get(artifact.id)!;
    const lockedContainer = locked.get(container.id)!;
    await validateEdgeAuthority(permix, lockedArtifact, lockedContainer, 'create', access);
    return writePlacement(lockedArtifact, lockedContainer, access);
  });
};
