/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db, polymorphicKeyColumns } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { ArtifactKind } from '@template/db/generated/client/enums';
import { isRootKind } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/services/artifactOwner';

export const assertNotRootArtifact = (
  artifact: Pick<Artifact, 'kind'>,
  message = 'Root container cannot be modified directly',
): void => {
  if (isRootKind(artifact.kind)) {
    throw makeError({ status: 422, message });
  }
};

export const fetchOwnerRootArtifact = (owner: OwnerRef): Promise<Artifact | null> =>
  db.artifact.findFirst({
    where: { ...ownerColumns(owner), kind: ArtifactKind.root },
  });

const nonNullRootLockWhere = (owner: OwnerRef): Record<string, unknown> => {
  const columns = ownerColumns(owner);
  const where: Record<string, unknown> = {
    ownerModel: columns.ownerModel,
    kind: ArtifactKind.root,
  };
  for (const key of polymorphicKeyColumns('Artifact', 'ownerModel', columns.ownerModel)) {
    where[key] = columns[key as 'userId' | 'organizationId' | 'spaceId'];
  }
  return where;
};

export const ensureOwnerRootArtifact = (owner: OwnerRef): Promise<Artifact> =>
  db.txn(async () => {
    const [existing] = await db.findForUpdate<Artifact>('Artifact', nonNullRootLockWhere(owner), {
      upserting: true,
    });
    if (existing && !existing.deletedAt) return existing;
    return db.artifact.create({
      data: {
        ...ownerColumns(owner),
        kind: ArtifactKind.root,
        name: 'Root',
      },
    });
  });
