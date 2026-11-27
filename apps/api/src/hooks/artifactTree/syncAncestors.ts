/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type {
  OperateAccess,
  PlacementOperateAccess,
  PlacementReadAccess,
  ReadAccess,
} from '@template/db/generated/client/enums';
import type { TreeAround } from '#/hooks/artifactTree/fetchArtifactTreeAround';
import { syncJoinRows } from '#/hooks/artifactTree/syncJoinRows';
import { sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';

export type AncestorEdge = { inherits: boolean; depth: number };
export type EffectiveAccess = {
  effectiveReadAccess: ReadAccess;
  effectiveOperateAccess: OperateAccess;
};

const READ_RANK: Record<PlacementReadAccess, number> = {
  inherit: 0,
  private: 0,
  tenant: 1,
  public: 2,
};
const READ_BY_RANK = ['private', 'tenant', 'public'] as const;

const OPERATE_RANK: Record<PlacementOperateAccess, number> = {
  inherit: 0,
  private: 0,
  tenant: 1,
};
const OPERATE_BY_RANK = ['private', 'tenant'] as const;

export const resolveArtifactTree = ({ artifacts, externalParents }: TreeAround) => {
  const memo = new Map<
    string,
    { ancestors: Map<string, AncestorEdge>; readRank: number; operateRank: number }
  >();

  const walk = (
    artifactId: string,
    visiting: Set<string>,
  ): { ancestors: Map<string, AncestorEdge>; readRank: number; operateRank: number } => {
    const cached = memo.get(artifactId);
    if (cached) return cached;

    const node = artifacts.get(artifactId);
    const ancestors = new Map<string, AncestorEdge>();
    if (!node || visiting.has(artifactId)) return { ancestors, readRank: 0, operateRank: 0 };

    const nextVisiting = new Set(visiting).add(artifactId);
    let readRank = 0;
    let operateRank = 0;

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

    for (const {
      containerArtifactId: parentId,
      readAccess,
      operateAccess,
    } of node.artifactPlacementsAsArtifact) {
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

      // why: cross-owner and explicit private/tenant edges stop ancestor grant inheritance.
      const sameOwner = sameArtifactOwner(node, parent);
      const edgeInherits = sameOwner && (readAccess === 'inherit' || readAccess === 'public');

      merge(parentId, { inherits: edgeInherits, depth: 1 });
      for (const [ancestorId, ancestorEdge] of parentAncestors) {
        if (ancestorId === artifactId) continue;
        merge(ancestorId, {
          inherits: edgeInherits && ancestorEdge.inherits,
          depth: ancestorEdge.depth + 1,
        });
      }

      if (sameOwner && node.kind !== 'root') {
        const readContribution =
          readAccess === 'inherit'
            ? parent.kind !== 'root'
              ? (parentState?.readRank ?? READ_RANK[parent.effectiveReadAccess])
              : 0
            : READ_RANK[readAccess];
        if (readContribution > readRank) readRank = readContribution;

        const operateContribution =
          operateAccess === 'inherit'
            ? parent.kind !== 'root'
              ? (parentState?.operateRank ?? OPERATE_RANK[parent.effectiveOperateAccess])
              : 0
            : OPERATE_RANK[operateAccess];
        if (operateContribution > operateRank) operateRank = operateContribution;
      }
    }

    const state = { ancestors, readRank, operateRank };
    memo.set(artifactId, state);
    return state;
  };

  return (artifactId: string): { ancestors: Map<string, AncestorEdge> } & EffectiveAccess => {
    const { ancestors, readRank, operateRank } = walk(artifactId, new Set());
    return {
      ancestors,
      effectiveReadAccess: READ_BY_RANK[readRank] ?? 'private',
      effectiveOperateAccess: OPERATE_BY_RANK[operateRank] ?? 'private',
    };
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
