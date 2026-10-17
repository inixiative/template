/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Artifact, ArtifactPermission } from '@template/db/generated/client/client';

export const ARTIFACT_MAX_DEPTH = 10;

export type ArtifactNode = Artifact & {
  permissions: ArtifactPermission[];
  containerArtifactIds: string[];
};

export type ArtifactGraph = Map<string, ArtifactNode>;

export const loadArtifactGraph = async (artifactIds: string[]): Promise<ArtifactGraph> => {
  const graph: ArtifactGraph = new Map();
  let frontier = [...new Set(artifactIds)];
  for (let depth = 0; frontier.length > 0 && depth <= ARTIFACT_MAX_DEPTH + 1; depth++) {
    const artifacts = await db.artifact.findMany({
      where: { id: { in: frontier }, deletedAt: undefined },
      include: { permissions: true, containers: { select: { containerArtifactId: true } } },
    });
    const next = new Set<string>();
    for (const { containers, ...artifact } of artifacts) {
      const containerArtifactIds = containers.map((edge) => edge.containerArtifactId);
      graph.set(artifact.id, { ...artifact, containerArtifactIds });
      for (const id of containerArtifactIds) if (!graph.has(id)) next.add(id);
    }
    frontier = [...next];
  }
  return graph;
};
