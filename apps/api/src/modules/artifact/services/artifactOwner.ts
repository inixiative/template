/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db, emptySideKeyColumns, polymorphicAxis, polymorphicKeyColumns } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';

export type OwnedArtifact = Pick<Artifact, 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'>;

export const artifactOwner = (
  artifact: OwnedArtifact,
): { ownerModel: string; ownerId: string } => ({
  ownerModel: artifact.ownerModel,
  ownerId: polymorphicKeyColumns('Artifact', 'ownerModel', artifact.ownerModel)
    .map((column) => String(artifact[column as keyof OwnedArtifact]))
    .join(':'),
});

export const sameArtifactOwner = (a: OwnedArtifact, b: OwnedArtifact): boolean => {
  const left = artifactOwner(a);
  const right = artifactOwner(b);
  return left.ownerModel === right.ownerModel && left.ownerId === right.ownerId;
};

export const withArtifactOwnersLock = <T>(
  artifacts: OwnedArtifact[],
  fn: () => Promise<T>,
): Promise<T> => {
  const unique = new Map<string, { ownerModel: string; ownerId: string }>();
  for (const artifact of artifacts) {
    const owner = artifactOwner(artifact);
    unique.set(`${owner.ownerModel}:${owner.ownerId}`, owner);
  }
  const ordered = [...unique.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  const acquire = (index: number): Promise<T> => {
    const owner = ordered[index];
    if (!owner) return fn();
    return withOwnerLock(owner, 'containers', () => acquire(index + 1));
  };
  return acquire(0);
};

export const lockArtifactsInTxn = async (ids: string[]): Promise<Map<string, Artifact>> => {
  const sorted = [...new Set(ids)].sort();
  const locked = new Map<string, Artifact>();
  for (const id of sorted) {
    const [row] = await db.findForUpdate<Artifact>('Artifact', { id });
    if (!row || row.deletedAt) throw makeError({ status: 404, message: 'Artifact not found' });
    locked.set(id, row);
  }
  return locked;
};

export const withLockedArtifacts = <T>(
  artifacts: Artifact[],
  fn: (locked: Map<string, Artifact>) => Promise<T>,
  extraOwners: OwnedArtifact[] = [],
): Promise<T> =>
  withArtifactOwnersLock([...artifacts, ...extraOwners], () =>
    db.txn(async () => {
      const locked = await lockArtifactsInTxn(artifacts.map((artifact) => artifact.id));
      for (const prelocked of artifacts) {
        if (!sameArtifactOwner(locked.get(prelocked.id)!, prelocked)) {
          throw makeError({
            status: 409,
            message: 'Artifact ownership changed while waiting for lock; please retry',
          });
        }
      }
      return fn(locked);
    }),
  );

export type OwnerRef = Pick<OwnedArtifact, 'ownerModel'> & Partial<OwnedArtifact>;

const emptyOwnerKeys = emptySideKeyColumns(polymorphicAxis('Artifact', 'ownerModel')) as Pick<
  OwnedArtifact,
  'userId' | 'organizationId' | 'spaceId'
>;

export const ownerColumns = (artifact: OwnerRef): OwnedArtifact => {
  const allowed = new Set(polymorphicKeyColumns('Artifact', 'ownerModel', artifact.ownerModel));
  return {
    ...emptyOwnerKeys,
    ownerModel: artifact.ownerModel,
    ...(allowed.has('userId') && artifact.userId != null ? { userId: artifact.userId } : {}),
    ...(allowed.has('organizationId') && artifact.organizationId != null
      ? { organizationId: artifact.organizationId }
      : {}),
    ...(allowed.has('spaceId') && artifact.spaceId != null ? { spaceId: artifact.spaceId } : {}),
  };
};
