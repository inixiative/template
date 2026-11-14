/**
 * @atlas
 * @kind helper
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { polymorphicTarget } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';

export type OwnedArtifact = Pick<Artifact, 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'>;

export const sameArtifactOwner = (a: OwnedArtifact, b: OwnedArtifact): boolean =>
  a.ownerModel === b.ownerModel &&
  a.userId === b.userId &&
  a.organizationId === b.organizationId &&
  a.spaceId === b.spaceId;

export const artifactOwner = (artifact: OwnedArtifact) => {
  const owner = polymorphicTarget(artifact, 'Artifact', 'ownerModel');
  if (!owner) throw new Error('Artifact has no owner');
  return { ownerModel: owner.kind, ownerId: owner.id };
};

export type OwnerRef = Pick<OwnedArtifact, 'ownerModel'> & Partial<OwnedArtifact>;

export const ownerColumns = (artifact: OwnerRef): OwnedArtifact => ({
  ownerModel: artifact.ownerModel,
  userId: artifact.userId ?? null,
  organizationId: artifact.organizationId ?? null,
  spaceId: artifact.spaceId ?? null,
});
