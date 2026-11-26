/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import type { TreeAround } from '#/hooks/artifactTree/fetchArtifactTreeAround';
import { syncJoinRows } from '#/hooks/artifactTree/syncJoinRows';
import { sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';

export type AncestorEdge = { inherits: boolean; depth: number };
export type EffectiveAccess = 'private' | 'tenant' | 'public';

const ACCESS_RANK: Record<ArtifactAccess, number> = {
  inherit: 0,
  private: 0,
  tenant: 1,
  public: 2,
};
const ACCESS_BY_RANK = ['private', 'tenant', 'public'] as const;

export const resolveArtifactTree = ({ artifacts, externalParents }: TreeAround) => {
  const memo = new Map<string, { ancestors: Map<string, AncestorEdge>; accessRank: number }>();

  const walk = (
    artifactId: string,
    visiting: Set<string>,
  ): { ancestors: Map<string, AncestorEdge>; accessRank: number } => {
    const cached = memo.get(artifactId);
    if (cached) return cached;

    const node = artifacts.get(artifactId);
    const ancestors = new Map<string, AncestorEdge>();
    if (!node || visiting.has(artifactId)) return { ancestors, accessRank: 0 };

    const nextVisiting = new Set(visiting).add(artifactId);
    const hasTenant = node.ownerModel !== 'User';
    let accessRank = 0;

    const merge = (ancestorId: string, edge: AncestorEdge) => {
      const current = ancestors.get(ancestorId);
      if (current) {
        ancestors.set(ancestorId, {
          inherits: current.inherits || edge.inherits,
          depth: Math.max(current.depth, edge.depth),
        });
      } else {
        ancestors.set(ancestorId, edge);
      }
    };

    for (const { containerArtifactId: parentId, access } of node.artifactPlacementsAsArtifact) {
      const internalParent = artifacts.get(parentId);
      const externalParent = internalParent ? undefined : externalParents.get(parentId);
      const parent = internalParent ?? externalParent;
      if (!parent) continue;

      const parentState = internalParent ? walk(parentId, nextVisiting) : undefined;
      const parentAncestors: Iterable<[string, AncestorEdge]> = parentState
        ? parentState.ancestors
        : (externalParent?.artifactAncestorsAsDescendant.map(
            (row) =>
              [row.ancestorArtifactId, { inherits: row.inherits, depth: row.depth }] as const,
          ) ?? []);

      // why: cross-owner placements never inherit across tenants; private and explicit tenant
      // placements stop explicit folder grants from cascading down from ancestors.
      const sameOwner = sameArtifactOwner(node, parent);
      const edgeInherits = sameOwner && (access === 'inherit' || access === 'public');

      merge(parentId, { inherits: edgeInherits, depth: 1 });
      for (const [ancestorId, ancestorEdge] of parentAncestors) {
        if (ancestorId === artifactId) continue;
        merge(ancestorId, {
          inherits: edgeInherits && ancestorEdge.inherits,
          depth: ancestorEdge.depth + 1,
        });
      }

      if (sameOwner && node.kind !== 'root') {
        let contribution = 0;
        if (access === 'public') {
          contribution = ACCESS_RANK.public;
        } else if (access === 'tenant') {
          contribution = hasTenant ? ACCESS_RANK.tenant : 0;
        } else if (access === 'inherit' && parent.kind !== 'root') {
          contribution = parentState ? parentState.accessRank : ACCESS_RANK[parent.effectiveAccess];
          if (!hasTenant && contribution === ACCESS_RANK.tenant) contribution = 0;
        }
        if (contribution > accessRank) accessRank = contribution;
      }
    }

    const state = { ancestors, accessRank };
    memo.set(artifactId, state);
    return state;
  };

  return (
    artifactId: string,
  ): { ancestors: Map<string, AncestorEdge>; effectiveAccess: EffectiveAccess } => {
    const { ancestors, accessRank } = walk(artifactId, new Set());
    return { ancestors, effectiveAccess: ACCESS_BY_RANK[accessRank] ?? 'private' };
  };
};

export const syncAncestors = async (
  artifactIds: string[],
  desiredByArtifact: Map<string, Map<string, AncestorEdge>>,
): Promise<void> => {
  const existing = await db.artifactAncestor.findMany({
    where: { artifactId: { in: artifactIds } },
  });
  const desired = [...desiredByArtifact.entries()].flatMap(([artifactId, ancestors]) =>
    [...ancestors.entries()].map(([ancestorArtifactId, edge]) => ({
      artifactId,
      ancestorArtifactId,
      ...edge,
    })),
  );
  await syncJoinRows({
    existing,
    desired,
    keyOfExisting: (row) => `${row.artifactId}:${row.ancestorArtifactId}`,
    keyOfDesired: (row) => `${row.artifactId}:${row.ancestorArtifactId}`,
    matches: (current, next) => current.inherits === next.inherits && current.depth === next.depth,
    deleteIds: (ids) => db.artifactAncestor.deleteMany({ where: { id: { in: ids } } }),
    createRows: (data) => db.artifactAncestor.createManyAndReturn({ data }),
  });
};
