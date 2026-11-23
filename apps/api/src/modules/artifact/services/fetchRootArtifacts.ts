/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/lib/artifactOwner';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';

export const fetchRootArtifacts = async (permix: Permix, owner: OwnerRef): Promise<Artifact[]> => {
  const candidates = await db.artifact.findMany({
    where: ownerColumns(owner),
    include: { placements: { select: { containerArtifactId: true } } },
    orderBy: { name: 'asc' },
  });
  const readable = await listableArtifacts(permix, candidates);
  const containerIds = [
    ...new Set(
      readable.flatMap((artifact) => artifact.placements.map((p) => p.containerArtifactId)),
    ),
  ];
  const containers =
    containerIds.length > 0
      ? await db.artifact.findMany({ where: { id: { in: containerIds } } })
      : [];
  const visibleContainerIds = new Set(
    (await listableArtifacts(permix, containers)).map((container) => container.id),
  );
  return readable
    .filter((artifact) =>
      artifact.placements.every((p) => !visibleContainerIds.has(p.containerArtifactId)),
    )
    .map(({ placements: _placements, ...artifact }) => artifact);
};
