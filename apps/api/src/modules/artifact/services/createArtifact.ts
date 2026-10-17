/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { addArtifactToContainer } from '#/modules/artifact/services/addArtifactToContainer';

export type CreatorGrant = Omit<
  Prisma.ArtifactPermissionUncheckedCreateInput,
  'artifactId' | 'role'
>;

export type CreateArtifactInput = Omit<Prisma.ArtifactUncheckedCreateInput, 'access'> & {
  access?: ArtifactAccess;
  containerArtifactId?: string;
  creatorGrant?: CreatorGrant;
};

export const createArtifact = async (
  actor: ArtifactActor,
  { containerArtifactId, access, creatorGrant, ...data }: CreateArtifactInput,
): Promise<Artifact> => {
  return db.txn(async () => {
    const artifact = await db.artifact.create({
      data: { ...data, ...(access && access !== 'inherit' ? { access } : {}) },
    });
    if (creatorGrant) {
      await db.artifactPermission.create({
        data: { ...creatorGrant, artifactId: artifact.id, role: 'owner' },
      });
    }
    if (!containerArtifactId) return artifact;
    await addArtifactToContainer(actor, {
      artifactId: artifact.id,
      containerArtifactId,
      inherit: (access ?? 'inherit') === 'inherit',
    });
    return db.artifact.findUniqueOrThrow({ where: { id: artifact.id } });
  });
};
