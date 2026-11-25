/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { AncestorEdge, TreeAround } from '#/hooks/artifactTree/fetchArtifactTreeAround';
import { sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';

export const ancestorsOf = ({ artifacts, externalParents, externalAncestors }: TreeAround) => {
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

export const syncAncestors = async (
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
