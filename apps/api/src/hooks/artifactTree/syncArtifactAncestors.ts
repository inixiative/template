/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:caching
 */
import { db } from '@template/db';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';
import { type OwnedArtifact, sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';

type AncestorEdge = { inherits: boolean; inheritsAccess: boolean; depth: number };

type ArtifactNode = OwnedArtifact & { access: ArtifactAccess; parentIds: string[] };

type TreeAround = {
  artifacts: Map<string, ArtifactNode>;
  directPermissions: Map<string, string[]>;
  externalParents: Map<string, OwnedArtifact>;
  externalAncestors: Map<string, Map<string, AncestorEdge>>;
  externalPermissions: Map<string, string[]>;
};

const fetchDescendantIds = async (artifactIds: string[]): Promise<Set<string>> => {
  const rows = await db.artifactAncestor.findMany({
    where: { ancestorArtifactId: { in: artifactIds } },
    select: { artifactId: true },
  });
  const descendants = new Set(artifactIds);
  for (const { artifactId } of rows) descendants.add(artifactId);
  return descendants;
};

const fetchTreeAround = async (descendantIds: string[]): Promise<TreeAround> => {
  const rows = await db.artifact.findMany({
    where: { id: { in: descendantIds } },
    select: {
      id: true,
      access: true,
      ownerModel: true,
      userId: true,
      organizationId: true,
      spaceId: true,
      placements: {
        where: { containerArtifactId: { not: null } },
        select: { containerArtifactId: true },
      },
      permissions: { select: { id: true } },
    },
  });

  const artifacts = new Map<string, ArtifactNode>();
  const directPermissions = new Map<string, string[]>();
  const externalParentIds = new Set<string>();

  for (const row of rows) {
    const parentIds = row.placements.flatMap((placement) =>
      placement.containerArtifactId ? [placement.containerArtifactId] : [],
    );
    artifacts.set(row.id, {
      access: row.access,
      ownerModel: row.ownerModel,
      userId: row.userId,
      organizationId: row.organizationId,
      spaceId: row.spaceId,
      parentIds,
    });
    if (row.permissions.length > 0) {
      directPermissions.set(
        row.id,
        row.permissions.map((permission) => permission.id),
      );
    }
  }

  for (const node of artifacts.values()) {
    for (const parentId of node.parentIds) {
      if (!artifacts.has(parentId)) externalParentIds.add(parentId);
    }
  }

  const externalParents = new Map<string, OwnedArtifact>();
  const externalAncestors = new Map<string, Map<string, AncestorEdge>>();
  const externalPermissions = new Map<string, string[]>();

  if (externalParentIds.size > 0) {
    const liveParents = await db.artifact.findMany({
      where: { id: { in: [...externalParentIds] } },
      select: {
        id: true,
        ownerModel: true,
        userId: true,
        organizationId: true,
        spaceId: true,
        ancestors: {
          select: { ancestorArtifactId: true, inherits: true, inheritsAccess: true, depth: true },
        },
        effectivePermissions: { select: { permissionId: true } },
      },
    });
    for (const parent of liveParents) {
      externalParents.set(parent.id, parent);
      if (parent.ancestors.length > 0) {
        externalAncestors.set(
          parent.id,
          new Map(
            parent.ancestors.map((row) => [
              row.ancestorArtifactId,
              { inherits: row.inherits, inheritsAccess: row.inheritsAccess, depth: row.depth },
            ]),
          ),
        );
      }
      if (parent.effectivePermissions.length > 0) {
        externalPermissions.set(
          parent.id,
          parent.effectivePermissions.map((row) => row.permissionId),
        );
      }
    }
  }

  return {
    artifacts,
    directPermissions,
    externalParents,
    externalAncestors,
    externalPermissions,
  };
};

const ancestorsOf = ({ artifacts, externalParents, externalAncestors }: TreeAround) => {
  const memo = new Map<string, Map<string, AncestorEdge>>();

  const walk = (artifactId: string, visiting: Set<string>): Map<string, AncestorEdge> => {
    const cached = memo.get(artifactId);
    if (cached) return cached;

    const node = artifacts.get(artifactId);
    const result = new Map<string, AncestorEdge>();
    if (!node || visiting.has(artifactId)) return result;

    const nextVisiting = new Set(visiting).add(artifactId);
    const canInheritGrants = node.access !== 'private';
    const canInheritAccess = node.access === 'inherit';

    const merge = (ancestorId: string, edge: AncestorEdge) => {
      const current = result.get(ancestorId);
      result.set(
        ancestorId,
        current
          ? {
              inherits: current.inherits || edge.inherits,
              inheritsAccess: current.inheritsAccess || edge.inheritsAccess,
              depth: Math.max(current.depth, edge.depth),
            }
          : edge,
      );
    };

    for (const parentId of node.parentIds) {
      const internalParent = artifacts.get(parentId);
      const parentOwner = internalParent ?? externalParents.get(parentId);
      if (!parentOwner) continue;

      const parentAncestors = internalParent
        ? walk(parentId, nextVisiting)
        : (externalAncestors.get(parentId) ?? new Map<string, AncestorEdge>());

      // why: cross-owner placements never inherit across tenants; visibility inheritance
      // (inheritsAccess) also stops at explicit non-inherit nodes (e.g. tenant inside public).
      const sameOwner = sameArtifactOwner(node, parentOwner);
      const edgeInherits = canInheritGrants && sameOwner;
      const edgeInheritsAccess = canInheritAccess && sameOwner;

      merge(parentId, { inherits: edgeInherits, inheritsAccess: edgeInheritsAccess, depth: 1 });
      for (const [ancestorId, ancestorEdge] of parentAncestors) {
        if (ancestorId === artifactId) continue;
        merge(ancestorId, {
          inherits: edgeInherits && ancestorEdge.inherits,
          inheritsAccess: edgeInheritsAccess && ancestorEdge.inheritsAccess,
          depth: ancestorEdge.depth + 1,
        });
      }
    }

    memo.set(artifactId, result);
    return result;
  };

  return (artifactId: string) => walk(artifactId, new Set());
};

const syncAncestors = async (
  artifactIds: string[],
  desiredByArtifact: Map<string, Map<string, AncestorEdge>>,
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
    inheritsAccess: boolean;
    depth: number;
  }[] = [];

  for (const [artifactId, ancestors] of desiredByArtifact) {
    for (const [ancestorArtifactId, edge] of ancestors) {
      const key = `${artifactId}:${ancestorArtifactId}`;
      const current = existingByKey.get(key);
      if (!current) {
        toCreate.push({ artifactId, ancestorArtifactId, ...edge });
      } else {
        existingByKey.delete(key);
        if (
          current.inherits !== edge.inherits ||
          current.inheritsAccess !== edge.inheritsAccess ||
          current.depth !== edge.depth
        ) {
          toDeleteIds.push(current.id);
          toCreate.push({ artifactId, ancestorArtifactId, ...edge });
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
  { directPermissions, externalParents, externalPermissions }: TreeAround,
  desiredByArtifact: Map<string, Map<string, AncestorEdge>>,
): Promise<void> => {
  const existing = await db.artifactEffectivePermission.findMany({
    where: { artifactId: { in: artifactIds } },
  });
  const existingByKey = new Map(
    existing.map((row) => [`${row.artifactId}:${row.permissionId}`, row]),
  );

  const insideTree = new Set(artifactIds);
  const toCreate: { artifactId: string; permissionId: string }[] = [];

  for (const artifactId of artifactIds) {
    const desiredPermissionIds = new Set(directPermissions.get(artifactId) ?? []);
    for (const [ancestorId, edge] of desiredByArtifact.get(artifactId) ?? []) {
      if (!edge.inherits) continue;
      const sourcePerms = insideTree.has(ancestorId)
        ? directPermissions.get(ancestorId)
        : externalParents.has(ancestorId)
          ? externalPermissions.get(ancestorId)
          : undefined;
      for (const permissionId of sourcePerms ?? []) desiredPermissionIds.add(permissionId);
    }
    for (const permissionId of desiredPermissionIds) {
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

export const syncArtifactAncestors = async (artifactIds: string[]): Promise<void> => {
  const uniqueIds = [...new Set(artifactIds)];
  if (uniqueIds.length === 0) return;

  await db.withoutDeleted(async () => {
    const descendants = await fetchDescendantIds(uniqueIds);
    const tree = await fetchTreeAround([...descendants]);
    const liveIds = [...descendants].filter((id) => tree.artifacts.has(id));
    const deadIds = [...descendants].filter((id) => !tree.artifacts.has(id));

    if (deadIds.length > 0) {
      await db.artifactAncestor.deleteMany({ where: { artifactId: { in: deadIds } } });
      await db.artifactEffectivePermission.deleteMany({ where: { artifactId: { in: deadIds } } });
    }
    if (liveIds.length === 0) return;

    const resolveAncestors = ancestorsOf(tree);
    const desiredByArtifact = new Map<string, Map<string, AncestorEdge>>(
      liveIds.map((id) => [id, resolveAncestors(id)]),
    );

    await syncAncestors(liveIds, desiredByArtifact);
    await syncEffectivePermissions(liveIds, tree, desiredByArtifact);
  });
};

export const clearDescendantCaches = async (artifactIds: string[]): Promise<void> => {
  const uniqueIds = [...new Set(artifactIds)];
  if (uniqueIds.length === 0) return;

  await db.withoutDeleted(async () => {
    const rows = await db.artifactAncestor.findMany({
      where: { ancestorArtifactId: { in: uniqueIds }, inheritsAccess: true },
      select: { artifactId: true },
    });
    if (rows.length === 0) return;
    await queueCacheClear(
      'Artifact',
      [...new Set(rows.map((row) => row.artifactId))].map((id) => ({ id })),
    );
  });
};
