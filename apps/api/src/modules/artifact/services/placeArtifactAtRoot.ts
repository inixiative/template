/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import {
  type OwnerRef,
  ownerColumns,
  sameArtifactOwner,
  withArtifactOwnersLock,
} from '#/modules/artifact/services/artifactOwner';
import { fetchArtifact } from '#/modules/artifact/services/artifactPlacementHelpers';

const assertRootPlacementCreate = async (
  permix: Permix,
  owner: OwnerRef,
  artifactId: string,
): Promise<void> => {
  const allowed = await holdsOnRecord(
    permix,
    'artifactPlacement',
    {
      id: '',
      ...ownerColumns(owner),
      containerArtifactId: null,
      artifactId,
    },
    'create',
  );
  if (!allowed) throw makeError({ status: 403, message: 'Forbidden' });
};

export const placeArtifactAtRoot = async (
  permix: Permix,
  owner: OwnerRef,
  artifactId: string,
): Promise<ArtifactPlacement> => {
  const ownerFields = ownerColumns(owner);
  const target = await fetchArtifact(artifactId);
  await assertRootPlacementCreate(permix, owner, target.id);
  if (sameArtifactOwner(target, ownerFields)) {
    throw makeError({
      status: 422,
      message: 'Artifacts you own are already at your root when unplaced',
    });
  }

  return withArtifactOwnersLock([ownerFields, target], () =>
    db.txn(async () => {
      const [locked] = await db.findForUpdate<Artifact>('Artifact', { id: artifactId });
      if (!locked || locked.deletedAt) {
        throw makeError({ status: 404, message: 'Artifact not found' });
      }
      if (!sameArtifactOwner(locked, target)) {
        throw makeError({
          status: 409,
          message: 'Artifact ownership changed while waiting for lock; please retry',
        });
      }
      await assertRootPlacementCreate(permix, owner, locked.id);
      if (sameArtifactOwner(locked, ownerFields)) {
        throw makeError({
          status: 422,
          message: 'Artifacts you own are already at your root when unplaced',
        });
      }
      return db.artifactPlacement.create({
        data: {
          ...ownerFields,
          containerArtifactId: null,
          artifactId: locked.id,
        },
      });
    }),
  );
};
