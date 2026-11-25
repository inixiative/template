/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import type { ArtifactPlacement } from '@template/db/generated/client/client';
import { type ArtifactAccess, ArtifactKind } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import {
  type OwnerRef,
  ownerColumns,
  withLockedArtifacts,
} from '#/modules/artifact/services/artifactOwner';
import {
  fetchArtifactOrThrow,
  writePlacement,
} from '#/modules/artifact/services/artifactPlacementUtils';
import {
  ensureOwnerRootArtifact,
  fetchOwnerRootArtifact,
} from '#/modules/artifact/services/ownerRootArtifact';
import { validateArtifactCreateAtOwner } from '#/modules/artifact/validations/validateArtifactCreateAtOwner';
import { validateEdgeAuthority } from '#/modules/artifact/validations/validateEdgeAuthority';
import { validateNotRootArtifact } from '#/modules/artifact/validations/validateNotRootArtifact';
import { validatePlacementAccess } from '#/modules/artifact/validations/validatePlacementAccess';

export type PlaceArtifactInput =
  | {
      artifactId: string;
      containerArtifactId: string;
      access?: ArtifactAccess;
    }
  | {
      artifactId: string;
      owner: OwnerRef;
      access?: ArtifactAccess;
    };

export const placeArtifact = async (
  permix: Permix,
  input: PlaceArtifactInput,
): Promise<ArtifactPlacement> => {
  const artifact = await fetchArtifactOrThrow(input.artifactId);
  validateNotRootArtifact(artifact, 'Root container cannot be placed inside another container');

  let container = 'owner' in input ? await fetchOwnerRootArtifact(input.owner) : null;
  if ('owner' in input) {
    const ownerFields = ownerColumns(input.owner);
    const resolvedAccess = input.access ?? 'private';
    validatePlacementAccess({ kind: ArtifactKind.root }, resolvedAccess);
    if (!container) {
      await validateArtifactCreateAtOwner(permix, ArtifactKind.root, ownerFields, 'create');
      if (resolvedAccess !== 'private') {
        await validateArtifactCreateAtOwner(permix, ArtifactKind.root, ownerFields, 'manage');
      }
      container = await ensureOwnerRootArtifact(ownerFields);
    }
  } else {
    container = await fetchArtifactOrThrow(input.containerArtifactId);
  }

  await validateEdgeAuthority(permix, artifact, container, 'create', input.access);
  return withLockedArtifacts([artifact, container], async (locked) => {
    const lockedArtifact = locked.get(artifact.id)!;
    const lockedContainer = locked.get(container.id)!;
    validateNotRootArtifact(
      lockedArtifact,
      'Root container cannot be placed inside another container',
    );
    await validateEdgeAuthority(permix, lockedArtifact, lockedContainer, 'create', input.access);
    return writePlacement(lockedArtifact, lockedContainer, input.access);
  });
};
