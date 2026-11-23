/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:caching
 */
import { db } from '@template/db';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';

export const ARTIFACT_MAX_DEPTH = 50;

type AncestorInfo = { inherits: boolean; depth: number };

const collectDescendantIds = async (rootIds: string[]): Promise<Set<string>> => {
  const seen = new Set(rootIds);
  let frontier = [...seen];
  while (frontier.length > 0) {
    const edges = await db.artifactPlacement.findMany({
      where: { containerArtifactId: { in: frontier } },
      select: { artifactId: true },
    });
    const next: string[] = [];
    for (const { artifactId } of edges) {
      if (!seen.has(artifactId)) {
        seen.add(artifactId);
        next.push(artifactId);
      }
    }
    frontier = next;
  }
  return seen;
};

const fetchUpwardGraph = async (
  startIds: string[],
): Promise<Map<string, { access: ArtifactAccess; parents: string[] }>> => {
  const nodes = new Map<string, { access: ArtifactAccess; parents: string[] }>();
  let frontier = [...new Set(startIds)];
  while (frontier.length > 0) {
    const rows = await db.artifact.findMany({
      where: { id: { in: frontier } },
      select: {
        id: true,
        access: true,
        placements: { select: { containerArtifactId: true } },
      },
    });
    const next = new Set<string>();
    for (const row of rows) {
      const parents = row.placements.map((placement) => placement.containerArtifactId);
      nodes.set(row.id, { access: row.access, parents });
      for (const parentId of parents) {
        if (!nodes.has(parentId)) next.add(parentId);
      }
    }
    frontier = [...next];
  }
  return nodes;
};

const computeAncestorsMap = (nodes: Map<string, { access: ArtifactAccess; parents: string[] }>) => {
  const memo = new Map<string, Map<string, AncestorInfo>>();
  const visit = (artifactId: string, walking: Set<string>): Map<string, AncestorInfo> => {
    const cached = memo.get(artifactId);
    if (cached) return cached;
    const node = nodes.get(artifactId);
    const result = new Map<string, AncestorInfo>();
    if (!node || walking.has(artifactId)) return result;

    const nextWalking = new Set(walking).add(artifactId);
    const canInherit = node.access !== 'private';
    const merge = (ancestorId: string, info: AncestorInfo) => {
      const current = result.get(ancestorId);
      result.set(
        ancestorId,
        current
          ? {
              inherits: current.inherits || info.inherits,
              depth: Math.max(current.depth, info.depth),
            }
          : info,
      );
    };

    for (const parentId of node.parents) {
      if (!nodes.has(parentId)) continue;
      merge(parentId, { inherits: canInherit, depth: 1 });
      for (const [ancestorId, ancestorInfo] of visit(parentId, nextWalking)) {
        if (ancestorId === artifactId) continue;
        merge(ancestorId, {
          inherits: canInherit && ancestorInfo.inherits,
          depth: ancestorInfo.depth + 1,
        });
      }
    }
    memo.set(artifactId, result);
    return result;
  };
  return (artifactId: string) => visit(artifactId, new Set());
};

const syncAncestors = async (
  artifactIds: string[],
  desiredByArtifact: Map<string, Map<string, AncestorInfo>>,
): Promise<void> => {
  const existing = await db.artifactAncestor.findMany({
    where: { artifactId: { in: artifactIds } },
  });
  const existingByKey = new Map(
    existing.map((row) => [`${row.artifactId}:${row.ancestorArtifactId}`, row]),
  );

  const toDeleteIds: string[] = [];
  const toUpdate: { id: string; inherits: boolean; depth: number }[] = [];
  const toCreate: {
    artifactId: string;
    ancestorArtifactId: string;
    inherits: boolean;
    depth: number;
  }[] = [];

  for (const [artifactId, ancestors] of desiredByArtifact) {
    for (const [ancestorArtifactId, info] of ancestors) {
      const key = `${artifactId}:${ancestorArtifactId}`;
      const current = existingByKey.get(key);
      if (!current) {
        toCreate.push({ artifactId, ancestorArtifactId, ...info });
      } else {
        existingByKey.delete(key);
        if (current.inherits !== info.inherits || current.depth !== info.depth) {
          toUpdate.push({ id: current.id, ...info });
        }
      }
    }
  }
  for (const stale of existingByKey.values()) toDeleteIds.push(stale.id);

  if (toDeleteIds.length > 0) {
    await db.artifactAncestor.deleteMany({ where: { id: { in: toDeleteIds } } });
  }
  for (const row of toUpdate) {
    await db.artifactAncestor.update({
      where: { id: row.id },
      data: { inherits: row.inherits, depth: row.depth },
    });
  }
  if (toCreate.length > 0) {
    await db.artifactAncestor.createManyAndReturn({ data: toCreate });
  }
};

const syncEffectivePermissions = async (
  artifactIds: string[],
  desiredByArtifact: Map<string, Map<string, AncestorInfo>>,
): Promise<void> => {
  const permissionSources = new Set(artifactIds);
  for (const ancestors of desiredByArtifact.values()) {
    for (const [ancestorId, info] of ancestors) {
      if (info.inherits) permissionSources.add(ancestorId);
    }
  }

  const permissions = await db.artifactPermission.findMany({
    where: { artifactId: { in: [...permissionSources] } },
    select: { id: true, artifactId: true },
  });
  const permsByArtifact = new Map<string, string[]>();
  for (const permission of permissions) {
    const list = permsByArtifact.get(permission.artifactId) ?? [];
    list.push(permission.id);
    permsByArtifact.set(permission.artifactId, list);
  }

  const existing = await db.artifactEffectivePermission.findMany({
    where: { artifactId: { in: artifactIds } },
  });
  const existingByKey = new Map(
    existing.map((row) => [`${row.artifactId}:${row.permissionId}`, row]),
  );

  const toCreate: { artifactId: string; permissionId: string }[] = [];
  for (const artifactId of artifactIds) {
    const desiredPermIds = new Set(permsByArtifact.get(artifactId) ?? []);
    for (const [ancestorId, info] of desiredByArtifact.get(artifactId) ?? []) {
      if (!info.inherits) continue;
      for (const permId of permsByArtifact.get(ancestorId) ?? []) desiredPermIds.add(permId);
    }
    for (const permissionId of desiredPermIds) {
      const key = `${artifactId}:${permissionId}`;
      if (existingByKey.has(key)) {
        existingByKey.delete(key);
      } else {
        toCreate.push({ artifactId, permissionId });
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

export const syncArtifactSubgraph = async (rootIds: string[]): Promise<void> => {
  const uniqueRoots = [...new Set(rootIds)];
  if (uniqueRoots.length === 0) return;

  await db.withoutDeleted(async () => {
    const affected = await collectDescendantIds(uniqueRoots);
    const nodes = await fetchUpwardGraph([...affected]);
    const liveIds = [...affected].filter((id) => nodes.has(id));
    const deadIds = [...affected].filter((id) => !nodes.has(id));

    if (deadIds.length > 0) {
      await db.artifactAncestor.deleteMany({ where: { artifactId: { in: deadIds } } });
      await db.artifactEffectivePermission.deleteMany({ where: { artifactId: { in: deadIds } } });
    }
    if (liveIds.length === 0) return;

    const ancestorsOf = computeAncestorsMap(nodes);
    const desiredByArtifact = new Map<string, Map<string, AncestorInfo>>(
      liveIds.map((id) => [id, ancestorsOf(id)]),
    );

    await syncAncestors(liveIds, desiredByArtifact);
    await syncEffectivePermissions(liveIds, desiredByArtifact);
  });
};

export const syncArtifactPermissionEffective = async (permissionIds: string[]): Promise<void> => {
  const uniqueIds = [...new Set(permissionIds)];
  if (uniqueIds.length === 0) return;

  await db.withoutDeleted(async () => {
    const [livePermissions, existingRows] = await Promise.all([
      db.artifactPermission.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, artifactId: true },
      }),
      db.artifactEffectivePermission.findMany({
        where: { permissionId: { in: uniqueIds } },
      }),
    ]);

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

export const invalidateInheritingDescendants = async (artifactIds: string[]): Promise<void> => {
  const uniqueIds = [...new Set(artifactIds)];
  if (uniqueIds.length === 0) return;
  await db.withoutDeleted(async () => {
    const rows = await db.artifactAncestor.findMany({
      where: { ancestorArtifactId: { in: uniqueIds }, inherits: true },
      select: { artifactId: true },
    });
    if (rows.length === 0) return;
    await queueCacheClear(
      'Artifact',
      [...new Set(rows.map((row) => row.artifactId))].map((id) => ({ id })),
    );
  });
};
