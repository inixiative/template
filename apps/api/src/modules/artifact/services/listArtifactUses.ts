/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db } from '@template/db';
import type { ArtifactContainer, ResourceBinding } from '@template/db/generated/client/client';
import { isOwnerRootKind } from '@template/shared/artifact';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export type ArtifactUses = { placements: ArtifactContainer[]; bindings: ResourceBinding[] };

export const listArtifactUses = async (
  actor: ArtifactActor,
  artifactId: string,
): Promise<ArtifactUses> => {
  const [placements, bindings] = await Promise.all([
    db.artifactContainer.findMany({
      where: { artifactId },
      include: { containerArtifact: { select: { kind: true } } },
    }),
    db.resourceBinding.findMany({ where: { artifactId } }),
  ]);
  const verdicts = await checkArtifactAccess(
    actor,
    placements.map((placement) => placement.containerArtifactId),
    'read',
  );
  const visible = placements.filter(
    (placement) =>
      isOwnerRootKind(placement.containerArtifact.kind) ||
      verdicts.get(placement.containerArtifactId)?.allowed,
  );
  return {
    placements: visible.map(({ containerArtifact: _containerArtifact, ...placement }) => placement),
    bindings,
  };
};
