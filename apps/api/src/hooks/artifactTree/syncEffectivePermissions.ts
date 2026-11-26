/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { AncestorEdge, TreeAround } from '#/hooks/artifactTree/fetchArtifactTreeAround';
import { syncJoinRows } from '#/hooks/artifactTree/syncJoinRows';

export const syncEffectivePermissions = async (
  artifactIds: string[],
  { directPermissions, externalParents, externalPermissions }: TreeAround,
  desiredByArtifact: Map<string, Map<string, AncestorEdge>>,
): Promise<void> => {
  const existing = await db.artifactEffectivePermission.findMany({
    where: { artifactId: { in: artifactIds } },
  });
  const insideTree = new Set(artifactIds);
  const desired: { artifactId: string; artifactPermissionId: string }[] = [];

  for (const artifactId of artifactIds) {
    const desiredPermissionIds = new Set(directPermissions.get(artifactId) ?? []);
    for (const [ancestorId, edge] of desiredByArtifact.get(artifactId) ?? []) {
      if (!edge.inherits) continue;
      const sourcePermissions = insideTree.has(ancestorId)
        ? directPermissions.get(ancestorId)
        : externalParents.has(ancestorId)
          ? externalPermissions.get(ancestorId)
          : undefined;
      for (const permissionId of sourcePermissions ?? []) desiredPermissionIds.add(permissionId);
    }
    for (const artifactPermissionId of desiredPermissionIds) {
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
