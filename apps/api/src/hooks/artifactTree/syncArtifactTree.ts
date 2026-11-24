/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:caching
 */
import { db } from '@template/db';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';
import { type OwnedArtifact, sameArtifactOwner } from '#/modules/artifact/lib/artifactOwner';

type AncestorInfo = { inherits: boolean; depth: number };

type TreeNode = OwnedArtifact & { access: ArtifactAccess; parents: string[] };

const collectDescendantIds = async (rootIds: string[]): Promise<Set<string>> => {
  const rows = await db.artifactAncestor.findMany({
    where: { ancestorArtifactId: { in: rootIds } },
    select: { artifactId: true },
  });
  const seen = new Set(rootIds);
  for (const { artifactId } of rows) seen.add(artifactId);
  return seen;
};

type SubgraphContext = {
  nodes: Map<string, TreeNode>;
  directPermsByArtifact: Map<string, string[]>;
  boundaryParents: Map<string, OwnedArtifact>;
  boundaryAncestors: Map<string, Map<string, AncestorInfo>>;
  boundaryPermsByArtifact: Map<string, string[]>;
};

const fetchSubgraphContext = async (affectedIds: string[]): Promise<SubgraphContext> => {
  const rows = await db.artifact.findMany({
    where: { id: { in: affectedIds } },
    select: {
      id: true,
      access: true,
      ownerModel: true,
      userId: true,
      organizationId: true,
      spaceId: true,
      placements: { select: { containerArtifactId: true } },
      permissions: { select: { id: true } },
    },
  });
  const nodes = new Map<string, TreeNode>();
  const directPermsByArtifact = new Map<string, string[]>();
  const boundaryCandidateIds = new Set<string>();
  for (const row of rows) {
    const parents = row.placements.map((placement) => placement.containerArtifactId);
    nodes.set(row.id, {
      access: row.access,
      ownerModel: row.ownerModel,
      userId: row.userId,
      organizationId: row.organizationId,
      spaceId: row.spaceId,
      parents,
    });
    if (row.permissions.length > 0) {
      directPermsByArtifact.set(
        row.id,
        row.permissions.map((permission) => permission.id),
      );
    }
  }
  for (const node of nodes.values()) {
    for (const parentId of node.parents) {
      if (!nodes.has(parentId)) boundaryCandidateIds.add(parentId);
    }
  }

  const boundaryParents = new Map<string, OwnedArtifact>();
  const boundaryAncestors = new Map<string, Map<string, AncestorInfo>>();
  const boundaryPermsByArtifact = new Map<string, string[]>();
  if (boundaryCandidateIds.size > 0) {
    const liveParents = await db.artifact.findMany({
      where: { id: { in: [...boundaryCandidateIds] } },
      select: {
        id: true,
        ownerModel: true,
        userId: true,
        organizationId: true,
        spaceId: true,
        ancestors: { select: { ancestorArtifactId: true, inherits: true, depth: true } },
        effectivePermissions: { select: { permissionId: true } },
      },
    });
    for (const parent of liveParents) {
      boundaryParents.set(parent.id, parent);
      if (parent.ancestors.length > 0) {
        boundaryAncestors.set(
          parent.id,
          new Map(
            parent.ancestors.map((row) => [
              row.ancestorArtifactId,
              { inherits: row.inherits, depth: row.depth },
            ]),
          ),
        );
      }
      if (parent.effectivePermissions.length > 0) {
        boundaryPermsByArtifact.set(
          parent.id,
          parent.effectivePermissions.map((row) => row.permissionId),
        );
      }
    }
  }

  return {
    nodes,
    directPermsByArtifact,
    boundaryParents,
    boundaryAncestors,
    boundaryPermsByArtifact,
  };
};

const computeAncestorsMap = ({ nodes, boundaryParents, boundaryAncestors }: SubgraphContext) => {
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
      const internalParent = nodes.get(parentId);
      const boundaryParent = internalParent ? undefined : boundaryParents.get(parentId);
      const parentOwner = internalParent ?? boundaryParent;
      if (!parentOwner) continue;

      const parentAncestors = internalParent
        ? visit(parentId, nextWalking)
        : (boundaryAncestors.get(parentId) ?? new Map<string, AncestorInfo>());
      // why: cross-owner placements organize without leaking permissions or public status across tenants.
      const edgeInherits = canInherit && sameArtifactOwner(node, parentOwner);
      merge(parentId, { inherits: edgeInherits, depth: 1 });
      for (const [ancestorId, ancestorInfo] of parentAncestors) {
        if (ancestorId === artifactId) continue;
        merge(ancestorId, {
          inherits: edgeInherits && ancestorInfo.inherits,
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
          toDeleteIds.push(current.id);
          toCreate.push({ artifactId, ancestorArtifactId, ...info });
        }
      }
    }
  }
  for (const stale of existingByKey.values()) toDeleteIds.push(stale.id);

  if (toDeleteIds.length > 0) {
    await db.artifactAncestor.deleteMany({ where: { id: { in: toDeleteIds } } });
  }
  if (toCreate.length > 0) {
    await db.artifactAncestor.createManyAndReturn({ data: toCreate });
  }
};

const syncEffectivePermissions = async (
  artifactIds: string[],
  { directPermsByArtifact, boundaryParents, boundaryPermsByArtifact }: SubgraphContext,
  desiredByArtifact: Map<string, Map<string, AncestorInfo>>,
): Promise<void> => {
  const existing = await db.artifactEffectivePermission.findMany({
    where: { artifactId: { in: artifactIds } },
  });

  const existingByKey = new Map(
    existing.map((row) => [`${row.artifactId}:${row.permissionId}`, row]),
  );

  const internalSet = new Set(artifactIds);
  const toCreate: { artifactId: string; permissionId: string }[] = [];
  for (const artifactId of artifactIds) {
    const desiredPermIds = new Set(directPermsByArtifact.get(artifactId) ?? []);
    for (const [ancestorId, info] of desiredByArtifact.get(artifactId) ?? []) {
      if (!info.inherits) continue;
      const sourcePerms = internalSet.has(ancestorId)
        ? directPermsByArtifact.get(ancestorId)
        : boundaryParents.has(ancestorId)
          ? boundaryPermsByArtifact.get(ancestorId)
          : undefined;
      for (const permId of sourcePerms ?? []) desiredPermIds.add(permId);
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
    const context = await fetchSubgraphContext([...affected]);
    const liveIds = [...affected].filter((id) => context.nodes.has(id));
    const deadIds = [...affected].filter((id) => !context.nodes.has(id));

    if (deadIds.length > 0) {
      await db.artifactAncestor.deleteMany({ where: { artifactId: { in: deadIds } } });
      await db.artifactEffectivePermission.deleteMany({ where: { artifactId: { in: deadIds } } });
    }
    if (liveIds.length === 0) return;

    const ancestorsOf = computeAncestorsMap(context);
    const desiredByArtifact = new Map<string, Map<string, AncestorInfo>>(
      liveIds.map((id) => [id, ancestorsOf(id)]),
    );

    await syncAncestors(liveIds, desiredByArtifact);
    await syncEffectivePermissions(liveIds, context, desiredByArtifact);
  });
};

export const syncArtifactPermissionEffective = async (permissionIds: string[]): Promise<void> => {
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
