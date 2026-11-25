/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import { type ArtifactAccess, ArtifactKind } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import {
  type OwnerRef,
  ownerColumns,
  sameArtifactOwner,
  withLockedArtifacts,
} from '#/modules/artifact/services/artifactOwner';
import {
  assertEdgeAuthority,
  assertPlacementAccessValid,
  fetchArtifact,
  writePlacement,
} from '#/modules/artifact/services/artifactPlacementHelpers';
import { canActOnArtifact } from '#/modules/artifact/services/checkArtifactPermission';
import {
  assertNotRootArtifact,
  ensureOwnerRootArtifact,
} from '#/modules/artifact/services/ownerRootArtifact';

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

const assertRootTargetAuthority = async (
  permix: Permix,
  member: Artifact,
  owner: OwnerRef,
  access: ArtifactAccess,
): Promise<void> => {
  const ownerFields = ownerColumns(owner);
  const syntheticRoot = {
    id: '',
    kind: ArtifactKind.root,
    effectiveAccess: 'private',
    ...ownerFields,
  };
  const canCreateRoot = await holdsOnRecord(permix, 'artifact', syntheticRoot, 'create');
  if (!canCreateRoot) throw makeError({ status: 403, message: 'Forbidden' });
  if (access !== 'private') {
    const canManageRoot = await holdsOnRecord(permix, 'artifact', syntheticRoot, 'manage');
    if (!canManageRoot) throw makeError({ status: 403, message: 'Forbidden' });
  }
  const sameOwner = sameArtifactOwner(member, ownerFields);
  if (!(await canActOnArtifact(permix, member, sameOwner ? 'manage' : 'read'))) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
};

export const placeArtifact = async (
  permix: Permix,
  input: PlaceArtifactInput,
): Promise<ArtifactPlacement> => {
  const member = await fetchArtifact(input.artifactId);
  assertNotRootArtifact(member, 'Root container cannot be placed inside another container');

  if ('owner' in input) {
    const ownerFields = ownerColumns(input.owner);
    const resolvedAccess = input.access ?? 'private';
    assertPlacementAccessValid({ kind: ArtifactKind.root }, resolvedAccess);
    await assertRootTargetAuthority(permix, member, ownerFields, resolvedAccess);

    return withLockedArtifacts(
      [member],
      async (locked) => {
        const lockedMember = locked.get(input.artifactId)!;
        assertNotRootArtifact(
          lockedMember,
          'Root container cannot be placed inside another container',
        );
        const root = await ensureOwnerRootArtifact(ownerFields);
        await assertEdgeAuthority(permix, lockedMember, root, 'create', resolvedAccess);
        return writePlacement(lockedMember, root, resolvedAccess);
      },
      [ownerFields],
    );
  }

  const container = await fetchArtifact(input.containerArtifactId);
  await assertEdgeAuthority(permix, member, container, 'create', input.access);
  return withLockedArtifacts([member, container], async (locked) => {
    const lockedMember = locked.get(input.artifactId)!;
    const lockedContainer = locked.get(input.containerArtifactId)!;
    assertNotRootArtifact(lockedMember, 'Root container cannot be placed inside another container');
    await assertEdgeAuthority(permix, lockedMember, lockedContainer, 'create', input.access);
    return writePlacement(lockedMember, lockedContainer, input.access);
  });
};
