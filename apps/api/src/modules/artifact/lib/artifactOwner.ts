/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { emptySideKeyColumns, polymorphicAxis, rowPolymorphicAxisPointsAt } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';

export type OwnedArtifact = Pick<Artifact, 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'>;

export const sameArtifactOwner = (a: OwnedArtifact, b: OwnedArtifact): boolean =>
  a.ownerModel === b.ownerModel &&
  a.userId === b.userId &&
  a.organizationId === b.organizationId &&
  a.spaceId === b.spaceId;

export const artifactOwner = (artifact: OwnedArtifact) => {
  const owner = rowPolymorphicAxisPointsAt(artifact, 'Artifact', 'ownerModel');
  if (!owner) throw new Error('Artifact has no owner');
  return { ownerModel: owner.model, ownerId: owner.id };
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
