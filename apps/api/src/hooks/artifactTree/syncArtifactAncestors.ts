/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import {
  type AncestorEdge,
  fetchArtifactTreeAround,
  fetchDescendantIds,
} from '#/hooks/artifactTree/fetchArtifactTreeAround';
import {
  type EffectiveAccess,
  resolveArtifactTree,
  syncAncestors,
} from '#/hooks/artifactTree/syncAncestors';
import { syncEffectiveAccess } from '#/hooks/artifactTree/syncEffectiveAccess';
import { syncEffectivePermissions } from '#/hooks/artifactTree/syncEffectivePermissions';

export const syncArtifactAncestors = async (artifactIds: string[]): Promise<void> => {
  const uniqueIds = [...new Set(artifactIds)];
  if (uniqueIds.length === 0) return;

  await db.withoutDeleted(async () => {
    const descendants = await fetchDescendantIds(uniqueIds);
    const tree = await fetchArtifactTreeAround([...descendants]);
    const activeIds = [...descendants].filter((id) => tree.artifacts.has(id));
    const deletedIds = [...descendants].filter((id) => !tree.artifacts.has(id));

    if (deletedIds.length > 0) {
      await db.artifactAncestor.deleteMany({ where: { artifactId: { in: deletedIds } } });
      await db.artifactEffectivePermission.deleteMany({
        where: { artifactId: { in: deletedIds } },
      });
    }
    if (activeIds.length === 0) return;

    const resolveNode = resolveArtifactTree(tree);
    const desiredAncestors = new Map<string, Map<string, AncestorEdge>>();
    const desiredAccess = new Map<string, EffectiveAccess>();
    for (const id of activeIds) {
      const state = resolveNode(id);
      desiredAncestors.set(id, state.ancestors);
      desiredAccess.set(id, state.effectiveAccess);
    }

    await syncAncestors(activeIds, desiredAncestors);
    await syncEffectivePermissions(activeIds, tree, desiredAncestors);
    await syncEffectiveAccess(activeIds, tree, desiredAccess);
  });
};
