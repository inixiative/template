/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { emptySideKeyColumns, polymorphicAxis, polymorphicKeyColumns } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
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

export type OwnerRef = Pick<OwnedArtifact, 'ownerModel'> & Partial<OwnedArtifact>;

const emptyOwnerKeys = emptySideKeyColumns(polymorphicAxis('Artifact', 'ownerModel')) as Pick<
  OwnedArtifact,
  'userId' | 'organizationId' | 'spaceId'
>;

export const ownerColumns = (artifact: OwnerRef): OwnedArtifact => ({
  ...emptyOwnerKeys,
  ownerModel: artifact.ownerModel,
  ...(artifact.userId != null ? { userId: artifact.userId } : {}),
  ...(artifact.organizationId != null ? { organizationId: artifact.organizationId } : {}),
  ...(artifact.spaceId != null ? { spaceId: artifact.spaceId } : {}),
});
