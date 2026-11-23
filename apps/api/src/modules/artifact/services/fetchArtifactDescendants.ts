/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { ReferenceMap } from '@template/shared/graph';
import { ARTIFACT_MAX_DEPTH } from '#/modules/artifact/services/fetchArtifactGraph';

export type ArtifactDescendants = { artifactIds: string[]; contents: ReferenceMap; height: number };

const longestPathHeight = (contents: ReferenceMap, rootId: string, cap: number): number => {
  const memo = new Map<string, number>();
  const walk = (id: string, walking: Set<string>): number => {
    if (walking.has(id)) return cap;
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const children = contents.get(id);
    if (!children || children.size === 0) {
      memo.set(id, 0);
      return 0;
    }
    const nextWalking = new Set(walking).add(id);
    let max = 0;
    for (const childId of children) {
      const candidate = 1 + walk(childId, nextWalking);
      if (candidate > max) max = candidate;
    }
    memo.set(id, max);
    return max;
  };
  return walk(rootId, new Set());
};

export const fetchArtifactDescendants = async (
  containerArtifactId: string,
  depth: number = ARTIFACT_MAX_DEPTH,
): Promise<ArtifactDescendants> => {
  const contents: ReferenceMap = new Map();
  const expanded = new Set<string>();
  const discovered = new Set<string>([containerArtifactId]);
  let frontier = [containerArtifactId];
  let rounds = 0;
  while (frontier.length > 0 && rounds <= depth) {
    const batch = frontier.filter((id) => !expanded.has(id));
    if (batch.length === 0) break;
    for (const id of batch) expanded.add(id);
    const edges = await db.artifactPlacement.findMany({
      where: {
        containerArtifactId: { in: batch },
        artifact: { type: 'container' },
      },
      select: { containerArtifactId: true, artifactId: true },
    });
    if (edges.length === 0) break;
    rounds += 1;
    const next: string[] = [];
    for (const { containerArtifactId: parent, artifactId } of edges) {
      if (!contents.has(parent)) contents.set(parent, new Set());
      contents.get(parent)!.add(artifactId);
      if (!discovered.has(artifactId)) {
        discovered.add(artifactId);
        next.push(artifactId);
      }
    }
    frontier = next;
  }
  discovered.delete(containerArtifactId);
  return {
    artifactIds: [...discovered],
    contents,
    height: longestPathHeight(contents, containerArtifactId, depth),
  };
};
