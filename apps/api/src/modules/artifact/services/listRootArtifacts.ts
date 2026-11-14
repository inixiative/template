/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/lib/artifactOwner';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';

export const listRootArtifacts = async (
  actor: ArtifactActor,
  owner: OwnerRef,
): Promise<Artifact[]> => {
  const candidates = await db.artifact.findMany({
    where: ownerColumns(owner),
    include: { placements: { select: { containerArtifactId: true } } },
    orderBy: { name: 'asc' },
  });
  const readable = await listableArtifacts(actor, candidates);
  const containerIds = [
    ...new Set(
      readable.flatMap((artifact) => artifact.placements.map((p) => p.containerArtifactId)),
    ),
  ];
  const visibleContainers = await checkArtifactAccess(actor, containerIds, 'read');
  return readable
    .filter((artifact) =>
      artifact.placements.every((p) => !visibleContainers.get(p.containerArtifactId)?.listed),
    )
    .map(({ placements: _placements, ...artifact }) => artifact);
};
