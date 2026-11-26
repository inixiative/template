/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:caching
 */
import { db } from '@template/db';
import type { TreeAround } from '#/hooks/artifactTree/fetchArtifactTreeAround';
import type { EffectiveAccess } from '#/hooks/artifactTree/syncAncestors';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';

const ACCESS_VALUES: readonly EffectiveAccess[] = ['private', 'tenant', 'public'];

export const syncEffectiveAccess = async (
  artifactIds: string[],
  tree: TreeAround,
  desiredByArtifact: Map<string, EffectiveAccess>,
): Promise<void> => {
  const byTarget: Record<EffectiveAccess, string[]> = { private: [], tenant: [], public: [] };
  const changedIds: string[] = [];

  for (const id of artifactIds) {
    const desired = desiredByArtifact.get(id) ?? 'private';
    if (tree.artifacts.get(id)?.effectiveAccess !== desired) {
      byTarget[desired].push(id);
      changedIds.push(id);
    }
  }

  for (const access of ACCESS_VALUES) {
    const ids = byTarget[access];
    if (ids.length === 0) continue;
    await db.artifact.updateManyAndReturn({
      where: { id: { in: ids } },
      data: { effectiveAccess: access },
    });
  }

  if (changedIds.length > 0) {
    // why: Artifact.effectiveAccess is in NOOP_FIELDS so the cache hook skips it; invalidate directly.
    await queueCacheClear(
      'Artifact',
      changedIds.map((id) => ({ id })),
    );
  }
};
