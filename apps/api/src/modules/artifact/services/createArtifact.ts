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
import {
  type OwnedArtifact,
  ownerColumns,
  sameArtifactOwner,
  withArtifactOwnersLock,
} from '#/modules/artifact/services/artifactOwner';
import {
  type CreateArtifactInput,
  insertArtifact,
} from '#/modules/artifact/services/artifactPlacementUtils';
import { validateArtifactCreateAtOwner } from '#/modules/artifact/validations/validateArtifactCreateAtOwner';
import { validateArtifactPermission } from '#/modules/artifact/validations/validateArtifactPermission';
import {
  defaultPlacementAccess,
  validatePlacementAccess,
} from '#/modules/artifact/validations/validatePlacementAccess';

export type { CreateArtifactInput };

export const createArtifact = async (
  permix: Permix,
  input: CreateArtifactInput,
): Promise<Artifact> => {
  const ownerFields = ownerColumns(input);
  const lockTargets: OwnedArtifact[] = [ownerFields];
  let prelockedContainer: Artifact | undefined;
  if (input.containerArtifactId) {
    prelockedContainer = await validateArtifactPermission(
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
    validatePlacementAccess(prelockedContainer, resolvedAccess);
    if (resolvedAccess !== defaultPlacementAccess(prelockedContainer)) {
      await validateArtifactPermission(permix, prelockedContainer, 'manage');
    }
    lockTargets.push(prelockedContainer);
  } else {
    const resolvedAccess = input.access ?? 'private';
    validatePlacementAccess({ kind: ArtifactKind.root }, resolvedAccess);
    if (resolvedAccess !== 'private') {
      await validateArtifactCreateAtOwner(permix, ArtifactKind.root, ownerFields, 'manage');
    }
  }
  return withArtifactOwnersLock(lockTargets, () =>
    db.txn(() => insertArtifact(input, permix, prelockedContainer)),
  );
};
