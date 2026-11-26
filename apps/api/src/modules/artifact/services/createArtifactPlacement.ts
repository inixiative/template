/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import { ArtifactKind } from '@template/db/generated/client/enums';
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
import { validateArtifactCreateAtOwner } from '#/modules/artifact/validations/validateArtifactCreateAtOwner';
import { validateNotRootArtifact } from '#/modules/artifact/validations/validateNotRootArtifact';
import type { PlacementAccessInput } from '#/modules/artifact/validations/validatePlacementAccess';
import { validatePlacementPermissions } from '#/modules/artifact/validations/validatePlacementPermissions';

type CreateArtifactPlacementInput = PlacementAccessInput &
  ({ artifact: Artifact; containerArtifactId: string } | { artifact: Artifact; owner: OwnerRef });

export const createArtifactPlacement = async (
  permix: Permix,
  input: CreateArtifactPlacementInput,
): Promise<ArtifactPlacement> => {
  const { artifact, readAccess, operateAccess } = input;
  const access: PlacementAccessInput = { readAccess, operateAccess };
  validateNotRootArtifact(artifact, 'Root container cannot be placed inside another container');
  let container: Artifact;
  if ('owner' in input) {
    await validateArtifactCreateAtOwner(permix, ArtifactKind.root, input.owner);
    container = await fetchOwnerRootArtifactOrThrow(input.owner);
  } else {
    container = await fetchArtifactOrThrow(input.containerArtifactId);
  }

  await validatePlacementPermissions(permix, artifact, container, 'create', access);
  return withLockedArtifacts([artifact, container], async (locked) => {
    const lockedArtifact = locked.get(artifact.id)!;
    const lockedContainer = locked.get(container.id)!;
    await validatePlacementPermissions(permix, lockedArtifact, lockedContainer, 'create', access);
    return writePlacement(lockedArtifact, lockedContainer, access);
  });
};
