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
import { ARTIFACT_EDGE_AUTHORITY } from '#/modules/artifact/lib/artifactEdgeAuthority';
import { assertArtifactAction } from '#/modules/artifact/lib/assertArtifactAction';
import { writeArtifactContainer } from '#/modules/artifact/services/addArtifactToContainer';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

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
  if (containerArtifactId) {
    const verdicts = await checkArtifactAccess(
      actor,
      [containerArtifactId],
      ARTIFACT_EDGE_AUTHORITY.container,
    );
    assertArtifactAction(verdicts.get(containerArtifactId), ARTIFACT_EDGE_AUTHORITY.container);
  }

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
    await writeArtifactContainer({
      artifactId: artifact.id,
      containerArtifactId,
      inherit: (access ?? 'inherit') === 'inherit',
    });
    return db.artifact.findUniqueOrThrow({ where: { id: artifact.id } });
  });
};
