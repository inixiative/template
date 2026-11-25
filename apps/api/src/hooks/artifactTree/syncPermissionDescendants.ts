/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:caching
 */
import { db } from '@template/db';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';

export const syncPermissionDescendants = async (permissionIds: string[]): Promise<void> => {
  const uniqueIds = [...new Set(permissionIds)];
  if (uniqueIds.length === 0) return;

  await db.withoutDeleted(async () => {
    const livePermissions = await db.artifactPermission.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, artifactId: true },
    });
    const existingRows = await db.artifactEffectivePermission.findMany({
      where: { permissionId: { in: uniqueIds } },
    });

    const liveById = new Map(livePermissions.map((permission) => [permission.id, permission]));
    const existingByKey = new Map(
      existingRows.map((row) => [`${row.artifactId}:${row.permissionId}`, row]),
    );
    const cacheEvictIds = new Set(existingRows.map((row) => row.artifactId));

    const sourceArtifactIds = [
      ...new Set(livePermissions.map((permission) => permission.artifactId)),
    ];
    const descendantRows =
      sourceArtifactIds.length > 0
        ? await db.artifactAncestor.findMany({
            where: { ancestorArtifactId: { in: sourceArtifactIds }, inherits: true },
            select: { artifactId: true, ancestorArtifactId: true },
          })
        : [];
    const descendantsBySource = new Map<string, string[]>();
    for (const row of descendantRows) {
      const list = descendantsBySource.get(row.ancestorArtifactId) ?? [];
      list.push(row.artifactId);
      descendantsBySource.set(row.ancestorArtifactId, list);
    }

    const toCreate: { artifactId: string; permissionId: string }[] = [];
    for (const permission of liveById.values()) {
      const targetIds = new Set([
        permission.artifactId,
        ...(descendantsBySource.get(permission.artifactId) ?? []),
      ]);
      for (const artifactId of targetIds) {
        cacheEvictIds.add(artifactId);
        const key = `${artifactId}:${permission.id}`;
        if (existingByKey.has(key)) {
          existingByKey.delete(key);
        } else {
          toCreate.push({ artifactId, permissionId: permission.id });
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
    if (cacheEvictIds.size > 0) {
      await queueCacheClear(
        'Artifact',
        [...cacheEvictIds].map((id) => ({ id })),
      );
    }
  });
};
