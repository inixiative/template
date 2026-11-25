/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:caching
 */
import { db } from '@template/db';
import type { ArtifactAccess, ArtifactKind } from '@template/db/generated/client/enums';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';
import { type OwnedArtifact, sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';

type AncestorEdge = { inherits: boolean; depth: number };

type PlacementEdge = { containerArtifactId: string; access: ArtifactAccess };

type ArtifactNode = OwnedArtifact & {
  kind: ArtifactKind;
  effectiveAccess: ArtifactAccess;
  placements: PlacementEdge[];
};

type ExternalParentNode = OwnedArtifact & {
  kind: ArtifactKind;
  effectiveAccess: ArtifactAccess;
};

type TreeAround = {
  artifacts: Map<string, ArtifactNode>;
  directPermissions: Map<string, string[]>;
  externalParents: Map<string, ExternalParentNode>;
  externalAncestors: Map<string, Map<string, AncestorEdge>>;
  externalPermissions: Map<string, string[]>;
};

const ACCESS_RANK: Record<'private' | 'tenant' | 'public', number> = {
  private: 0,
  tenant: 1,
  public: 2,
};

const ACCESS_BY_RANK = ['private', 'tenant', 'public'] as const;

const rankOf = (access: ArtifactAccess): number =>
  access === 'public' ? ACCESS_RANK.public : access === 'tenant' ? ACCESS_RANK.tenant : 0;

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
      kind: true,
      effectiveAccess: true,
      ownerModel: true,
      userId: true,
      organizationId: true,
      spaceId: true,
      placements: {
        select: { containerArtifactId: true, access: true },
      },
      permissions: { select: { id: true } },
    },
  });

  const artifacts = new Map<string, ArtifactNode>();
  const directPermissions = new Map<string, string[]>();
  const externalParentIds = new Set<string>();

  for (const row of rows) {
    artifacts.set(row.id, {
      kind: row.kind,
      effectiveAccess: row.effectiveAccess,
      ownerModel: row.ownerModel,
      userId: row.userId,
      organizationId: row.organizationId,
      spaceId: row.spaceId,
      placements: row.placements,
    });
    if (row.permissions.length > 0) {
      directPermissions.set(
        row.id,
        row.permissions.map((permission) => permission.id),
      );
    }
  }

  for (const node of artifacts.values()) {
    for (const { containerArtifactId } of node.placements) {
      if (!artifacts.has(containerArtifactId)) externalParentIds.add(containerArtifactId);
    }
  }

  const externalParents = new Map<string, ExternalParentNode>();
  const externalAncestors = new Map<string, Map<string, AncestorEdge>>();
  const externalPermissions = new Map<string, string[]>();

  if (externalParentIds.size > 0) {
    const liveParents = await db.artifact.findMany({
      where: { id: { in: [...externalParentIds] } },
      select: {
        id: true,
        kind: true,
        effectiveAccess: true,
        ownerModel: true,
        userId: true,
        organizationId: true,
        spaceId: true,
        ancestors: {
          select: { ancestorArtifactId: true, inherits: true, depth: true },
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
              { inherits: row.inherits, depth: row.depth },
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

    const merge = (ancestorId: string, edge: AncestorEdge) => {
      const current = result.get(ancestorId);
      result.set(
        ancestorId,
        current
          ? {
              inherits: current.inherits || edge.inherits,
              depth: Math.max(current.depth, edge.depth),
            }
          : edge,
      );
    };

    for (const { containerArtifactId: parentId, access } of node.placements) {
      const internalParent = artifacts.get(parentId);
      const parentOwner = internalParent ?? externalParents.get(parentId);
      if (!parentOwner) continue;

      const parentAncestors = internalParent
        ? walk(parentId, nextVisiting)
        : (externalAncestors.get(parentId) ?? new Map<string, AncestorEdge>());

      // why: cross-owner placements never inherit across tenants; private and explicit tenant
      // placements stop explicit folder grants from cascading down from ancestors.
      const sameOwner = sameArtifactOwner(node, parentOwner);
      const edgeInherits = sameOwner && (access === 'inherit' || access === 'public');

      merge(parentId, { inherits: edgeInherits, depth: 1 });
      for (const [ancestorId, ancestorEdge] of parentAncestors) {
        if (ancestorId === artifactId) continue;
        merge(ancestorId, {
          inherits: edgeInherits && ancestorEdge.inherits,
          depth: ancestorEdge.depth + 1,
        });
      }
    }

    memo.set(artifactId, result);
    return result;
  };

  return (artifactId: string) => walk(artifactId, new Set());
};

const effectiveAccessOf = ({ artifacts, externalParents }: TreeAround) => {
  const memo = new Map<string, number>();

  const walk = (artifactId: string, visiting: Set<string>): number => {
    const cached = memo.get(artifactId);
    if (cached !== undefined) return cached;

    const node = artifacts.get(artifactId);
    if (!node || node.kind === 'root' || visiting.has(artifactId)) return 0;

    const nextVisiting = new Set(visiting).add(artifactId);
    const hasTenant = node.ownerModel !== 'User';
    let best = 0;

    for (const { containerArtifactId: parentId, access } of node.placements) {
      const internalParent = artifacts.get(parentId);
      const parent = internalParent ?? externalParents.get(parentId);
      if (!parent || !sameArtifactOwner(node, parent)) continue;

      let contribution = 0;
      if (access === 'public') {
        contribution = ACCESS_RANK.public;
      } else if (access === 'tenant') {
        contribution = hasTenant ? ACCESS_RANK.tenant : 0;
      } else if (access === 'inherit') {
        if (parent.kind !== 'root') {
          contribution = internalParent
            ? walk(parentId, nextVisiting)
            : rankOf(parent.effectiveAccess);
          if (!hasTenant && contribution === ACCESS_RANK.tenant) contribution = 0;
        }
      }
      if (contribution > best) best = contribution;
    }

    memo.set(artifactId, best);
    return best;
  };

  return (artifactId: string): 'private' | 'tenant' | 'public' =>
    ACCESS_BY_RANK[walk(artifactId, new Set())]!;
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
        if (current.inherits !== edge.inherits || current.depth !== edge.depth) {
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

const syncEffectiveAccess = async (artifactIds: string[], tree: TreeAround): Promise<void> => {
  const resolveAccess = effectiveAccessOf(tree);
  const byTarget: Record<'private' | 'tenant' | 'public', string[]> = {
    private: [],
    tenant: [],
    public: [],
  };
  const changedIds: string[] = [];

  for (const id of artifactIds) {
    const desired = resolveAccess(id);
    if (tree.artifacts.get(id)?.effectiveAccess !== desired) {
      byTarget[desired].push(id);
      changedIds.push(id);
    }
  }

  for (const access of ACCESS_BY_RANK) {
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
    await syncEffectiveAccess(liveIds, tree);
  });
};
