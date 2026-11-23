/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';

export type ArtifactAncestry = {
  artifacts: Artifact[];
  edges: { artifactId: string; containerArtifactId: string }[];
};

export const fetchArtifactAncestors = async (
  permix: Permix,
  artifactId: string,
): Promise<ArtifactAncestry> => {
  const ancestorRows = await db.artifactAncestor.findMany({
    where: { artifactId },
    include: { ancestorArtifact: true },
  });
  const candidates = ancestorRows
    .map((row) => row.ancestorArtifact)
    .filter((artifact) => artifact.deletedAt === null);
  const readable = await listableArtifacts(permix, candidates);
  const readableById = new Map(readable.map((artifact) => [artifact.id, artifact]));
  if (readableById.size === 0) return { artifacts: [], edges: [] };

  const placements = await db.artifactPlacement.findMany({
    where: {
      artifactId: { in: [artifactId, ...readableById.keys()] },
      containerArtifactId: { in: [...readableById.keys()] },
    },
    select: { artifactId: true, containerArtifactId: true },
  });
  const parentsByNode = new Map<string, string[]>();
  for (const placement of placements) {
    const list = parentsByNode.get(placement.artifactId) ?? [];
    list.push(placement.containerArtifactId);
    parentsByNode.set(placement.artifactId, list);
  }

  const reached = new Set<string>();
  const edges: ArtifactAncestry['edges'] = [];
  const visit = (nodeId: string) => {
    for (const containerArtifactId of parentsByNode.get(nodeId) ?? []) {
      edges.push({ artifactId: nodeId, containerArtifactId });
      if (reached.has(containerArtifactId)) continue;
      reached.add(containerArtifactId);
      visit(containerArtifactId);
    }
  };
  visit(artifactId);

  return { artifacts: [...reached].map((id) => readableById.get(id)!), edges };
};
