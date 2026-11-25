/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import {
  type OwnedArtifact,
  ownerColumns,
  withArtifactOwnersLock,
} from '#/modules/artifact/services/artifactOwner';
import {
  type CreateArtifactInput,
  insertArtifact,
} from '#/modules/artifact/services/artifactPlacementHelpers';
import { assertArtifactPermission } from '#/modules/artifact/services/checkArtifactPermission';

export type { CreateArtifactInput };

export const createArtifact = async (
  permix: Permix,
  input: CreateArtifactInput,
): Promise<Artifact> => {
  const lockTargets: OwnedArtifact[] = [ownerColumns(input)];
  let prelockedContainer: Artifact | undefined;
  if (input.containerArtifactId) {
    prelockedContainer = await assertArtifactPermission(
      permix,
      input.containerArtifactId,
      'operate',
    );
    lockTargets.push(prelockedContainer);
  }
  return withArtifactOwnersLock(lockTargets, () =>
    db.txn(() => insertArtifact(input, permix, prelockedContainer)),
  );
};
