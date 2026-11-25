/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { AncestorEdge, TreeAround } from '#/hooks/artifactTree/fetchArtifactTreeAround';

export const syncEffectivePermissions = async (
  artifactIds: string[],
  { directPermissions, externalParents, externalPermissions }: TreeAround,
  desiredByArtifact: Map<string, Map<string, AncestorEdge>>,
): Promise<void> => {
  const existing = await db.artifactEffectivePermission.findMany({
    where: { artifactId: { in: artifactIds } },
  });
  const existingByKey = new Map(
    existing.map((row) => [`${row.artifactId}:${row.artifactPermissionId}`, row]),
  );

  const insideTree = new Set(artifactIds);
  const toCreate: { artifactId: string; artifactPermissionId: string }[] = [];

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
      const key = `${artifactId}:${artifactPermissionId}`;
      if (existingByKey.has(key)) {
        existingByKey.delete(key);
      } else {
        toCreate.push({ artifactId, artifactPermissionId });
      }
    }
  }

  const toDeleteIds = [...existingByKey.values()].map((row) => row.id);
  if (toDeleteIds.length > 0) {
    await db.artifactEffectivePermission.deleteMany({ where: { id: { in: toDeleteIds } } });
  }
  if (toCreate.length > 0) {
    await db.artifactEffectivePermission.createManyAndReturn({ data: toCreate });
  }
};
