/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import type { AncestorEdge, TreeAround } from '#/hooks/artifactTree/fetchArtifactTreeAround';
import { syncJoinRows } from '#/hooks/artifactTree/syncJoinRows';
import { sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';

export type EffectiveAccess = 'private' | 'tenant' | 'public';

type ResolvedNodeState = {
  ancestors: Map<string, AncestorEdge>;
  effectiveAccess: EffectiveAccess;
};

const ACCESS_RANK: Record<EffectiveAccess, number> = { private: 0, tenant: 1, public: 2 };
const ACCESS_BY_RANK = ['private', 'tenant', 'public'] as const;

const rankOf = (access: ArtifactAccess): number =>
  access === 'public' ? ACCESS_RANK.public : access === 'tenant' ? ACCESS_RANK.tenant : 0;

export const resolveArtifactTree = ({
  artifacts,
  externalParents,
  externalAncestors,
}: TreeAround) => {
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
      ancestors.set(
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
      const parent = internalParent ?? externalParents.get(parentId);
      if (!parent) continue;

      const parentState = internalParent ? walk(parentId, nextVisiting) : undefined;
      const parentAncestors =
        parentState?.ancestors ??
        externalAncestors.get(parentId) ??
        new Map<string, AncestorEdge>();
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
          contribution = parentState ? parentState.accessRank : rankOf(parent.effectiveAccess);
          if (!hasTenant && contribution === ACCESS_RANK.tenant) contribution = 0;
        }
        if (contribution > accessRank) accessRank = contribution;
      }
    }

    const state = { ancestors, accessRank };
    memo.set(artifactId, state);
    return state;
  };

  return (artifactId: string): ResolvedNodeState => {
    const { ancestors, accessRank } = walk(artifactId, new Set());
    return { ancestors, effectiveAccess: ACCESS_BY_RANK[accessRank]! };
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
