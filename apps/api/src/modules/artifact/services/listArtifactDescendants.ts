/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { ReferenceMap } from '@template/shared/graph';
import { ARTIFACT_MAX_DEPTH } from '#/modules/artifact/services/loadArtifactGraph';

export type ArtifactDescendants = { artifactIds: string[]; contents: ReferenceMap; height: number };

export const listArtifactDescendants = async (
  containerArtifactId: string,
  depth: number = ARTIFACT_MAX_DEPTH,
): Promise<ArtifactDescendants> => {
  const contents: ReferenceMap = new Map();
  const seen = new Set<string>([containerArtifactId]);
  let frontier = [containerArtifactId];
  let height = 0;
  while (frontier.length > 0 && height < depth) {
    const edges = await db.artifactPlacement.findMany({
      where: { containerArtifactId: { in: frontier } },
      select: { containerArtifactId: true, artifactId: true },
    });
    if (edges.length === 0) break;
    height += 1;
    const next: string[] = [];
    for (const { containerArtifactId: parent, artifactId } of edges) {
      if (!contents.has(parent)) contents.set(parent, new Set());
      contents.get(parent)!.add(artifactId);
      if (seen.has(artifactId)) continue;
      seen.add(artifactId);
      next.push(artifactId);
    }
    frontier = next;
  }
  seen.delete(containerArtifactId);
  return { artifactIds: [...seen], contents, height };
};
