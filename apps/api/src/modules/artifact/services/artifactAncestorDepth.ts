/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { loadArtifactGraph } from '#/modules/artifact/services/loadArtifactGraph';

export const artifactAncestorDepth = async (artifactId: string): Promise<number> => {
  const graph = await loadArtifactGraph([artifactId]);
  const memo = new Map<string, number>();
  const depthOf = (id: string, walking: Set<string>): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const node = graph.get(id);
    if (!node || walking.has(id)) return 0;
    const path = new Set(walking).add(id);
    const depth = Math.max(
      0,
      ...node.containerArtifactIds.map((parent) => 1 + depthOf(parent, path)),
    );
    memo.set(id, depth);
    return depth;
  };
  return depthOf(artifactId, new Set());
};
