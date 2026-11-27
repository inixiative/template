/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:caching
 */
import { db } from '@template/db';
import { syncJoinRows } from '#/hooks/artifactTree/syncJoinRows';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';

export const syncPermissionDescendants = async (permissionIds: string[]): Promise<void> => {
  const uniqueIds = [...new Set(permissionIds)];
  if (uniqueIds.length === 0) return;

  await db.withoutDeleted(async () => {
    const [activePermissions, existingRows] = await Promise.all([
      db.artifactPermission.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, artifactId: true },
      }),
      db.artifactEffectivePermission.findMany({
        where: { artifactPermissionId: { in: uniqueIds } },
      }),
    ]);

    const cacheEvictIds = new Set(existingRows.map((row) => row.artifactId));
    const sourceArtifactIds = [
      ...new Set(activePermissions.map((permission) => permission.artifactId)),
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

    const desired: { artifactId: string; artifactPermissionId: string }[] = [];
    for (const permission of activePermissions) {
      const targetIds = new Set([
        permission.artifactId,
        ...(descendantsBySource.get(permission.artifactId) ?? []),
      ]);
      for (const artifactId of targetIds) {
        cacheEvictIds.add(artifactId);
        desired.push({ artifactId, artifactPermissionId: permission.id });
      }
    }

    await syncJoinRows({
      existing: existingRows,
      desired,
      keyOfExisting: (row) => `${row.artifactId}:${row.artifactPermissionId}`,
      keyOfDesired: (row) => `${row.artifactId}:${row.artifactPermissionId}`,
      deleteIds: (ids) => db.artifactEffectivePermission.deleteMany({ where: { id: { in: ids } } }),
      createRows: (data) => db.artifactEffectivePermission.createManyAndReturn({ data }),
    });
    if (cacheEvictIds.size > 0) {
      await queueCacheClear(
        'Artifact',
        [...cacheEvictIds].map((id) => ({ id })),
      );
    }
  });
};
