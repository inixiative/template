/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { ArtifactKind } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import {
  type OwnedArtifact,
  ownerColumns,
  sameArtifactOwner,
  withArtifactOwnersLock,
} from '#/modules/artifact/services/artifactOwner';
import {
  assertPlacementAccessValid,
  type CreateArtifactInput,
  defaultPlacementAccess,
  insertArtifact,
} from '#/modules/artifact/services/artifactPlacementHelpers';
import { assertArtifactPermission } from '#/modules/artifact/services/checkArtifactPermission';

export type { CreateArtifactInput };

export const createArtifact = async (
  permix: Permix,
  input: CreateArtifactInput,
): Promise<Artifact> => {
  const ownerFields = ownerColumns(input);
  const lockTargets: OwnedArtifact[] = [ownerFields];
  let prelockedContainer: Artifact | undefined;
  if (input.containerArtifactId) {
    prelockedContainer = await assertArtifactPermission(
      permix,
      input.containerArtifactId,
      'operate',
    );
    if (!sameArtifactOwner(prelockedContainer, ownerFields)) {
      throw makeError({
        status: 422,
        message: 'Cannot create an artifact directly inside another owner container',
      });
    }
    const resolvedAccess = input.access ?? defaultPlacementAccess(prelockedContainer);
    assertPlacementAccessValid(prelockedContainer, resolvedAccess);
    if (resolvedAccess !== defaultPlacementAccess(prelockedContainer)) {
      await assertArtifactPermission(permix, input.containerArtifactId, 'manage');
    }
    lockTargets.push(prelockedContainer);
  } else {
    const resolvedAccess = input.access ?? 'private';
    assertPlacementAccessValid({ kind: ArtifactKind.root }, resolvedAccess);
    if (resolvedAccess !== 'private') {
      const canManageRoot = await holdsOnRecord(
        permix,
        'artifact',
        { id: '', kind: ArtifactKind.root, effectiveAccess: 'private', ...ownerFields },
        'manage',
      );
      if (!canManageRoot) throw makeError({ status: 403, message: 'Forbidden' });
    }
  }
  return withArtifactOwnersLock(lockTargets, () =>
    db.txn(() => insertArtifact(input, permix, prelockedContainer)),
  );
};
