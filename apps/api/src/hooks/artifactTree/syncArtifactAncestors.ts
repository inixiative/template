/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:caching
 */
import { db } from '@template/db';
import {
  type AncestorEdge,
  fetchArtifactTreeAround,
  fetchDescendantIds,
  type TreeAround,
} from '#/hooks/artifactTree/fetchArtifactTreeAround';
import {
  type EffectiveAccess,
  resolveArtifactTree,
  syncAncestors,
} from '#/hooks/artifactTree/syncAncestors';
import { syncJoinRows } from '#/hooks/artifactTree/syncJoinRows';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';

const ACCESS_VALUES: readonly EffectiveAccess[] = ['private', 'tenant', 'public'];

const syncEffectivePermissions = async (
  artifactIds: string[],
  { directPermissions, externalPermissions }: TreeAround,
  desiredByArtifact: Map<string, Map<string, AncestorEdge>>,
): Promise<void> => {
  const existing = await db.artifactEffectivePermission.findMany({
    where: { artifactId: { in: artifactIds } },
  });
  const insideTree = new Set(artifactIds);
  const desired: { artifactId: string; artifactPermissionId: string }[] = [];

  for (const artifactId of artifactIds) {
    const permissionIds = new Set(directPermissions.get(artifactId) ?? []);
    for (const [ancestorId, edge] of desiredByArtifact.get(artifactId) ?? []) {
      if (!edge.inherits) continue;
      const source = insideTree.has(ancestorId)
        ? directPermissions.get(ancestorId)
        : externalPermissions.get(ancestorId);
      for (const permissionId of source ?? []) permissionIds.add(permissionId);
    }
    for (const artifactPermissionId of permissionIds) {
      desired.push({ artifactId, artifactPermissionId });
    }
  }

  await syncJoinRows({
    existing,
    desired,
    keyOfExisting: (row) => `${row.artifactId}:${row.artifactPermissionId}`,
    keyOfDesired: (row) => `${row.artifactId}:${row.artifactPermissionId}`,
    deleteIds: (ids) => db.artifactEffectivePermission.deleteMany({ where: { id: { in: ids } } }),
    createRows: (data) => db.artifactEffectivePermission.createManyAndReturn({ data }),
  });
};

const syncEffectiveAccess = async (
  tree: TreeAround,
  desiredByArtifact: Map<string, EffectiveAccess>,
): Promise<void> => {
  const byTarget: Record<EffectiveAccess, string[]> = { private: [], tenant: [], public: [] };
  const changedIds: string[] = [];

  for (const [id, desired] of desiredByArtifact) {
    if (tree.artifacts.get(id)?.effectiveAccess !== desired) {
      byTarget[desired].push(id);
      changedIds.push(id);
    }
  }

  for (const access of ACCESS_VALUES) {
    if (byTarget[access].length === 0) continue;
    await db.artifact.updateManyAndReturn({
      where: { id: { in: byTarget[access] } },
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

export const syncArtifactAncestors = async (artifactIds: string[]): Promise<void> => {
  const uniqueIds = [...new Set(artifactIds)];
  if (uniqueIds.length === 0) return;

  await db.withoutDeleted(async () => {
    const descendants = await fetchDescendantIds(uniqueIds);
    const tree = await fetchArtifactTreeAround([...descendants]);
    const activeIds = [...tree.artifacts.keys()];
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
    await syncEffectiveAccess(tree, desiredAccess);
  });
};
