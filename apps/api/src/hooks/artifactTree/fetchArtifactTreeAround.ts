/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { ArtifactAccess, ArtifactKind } from '@template/db/generated/client/enums';
import type { OwnedArtifact } from '#/modules/artifact/services/artifactOwner';

export type AncestorEdge = { inherits: boolean; depth: number };

type PlacementEdge = { containerArtifactId: string; access: ArtifactAccess };

type ExternalParentNode = OwnedArtifact & {
  kind: ArtifactKind;
  effectiveAccess: ArtifactAccess;
};

type ArtifactNode = ExternalParentNode & {
  placements: PlacementEdge[];
};

export type TreeAround = {
  artifacts: Map<string, ArtifactNode>;
  directPermissions: Map<string, string[]>;
  externalParents: Map<string, ExternalParentNode>;
  externalAncestors: Map<string, Map<string, AncestorEdge>>;
  externalPermissions: Map<string, string[]>;
};

export const fetchDescendantIds = async (artifactIds: string[]): Promise<Set<string>> => {
  const rows = await db.artifactAncestor.findMany({
    where: { ancestorArtifactId: { in: artifactIds } },
    select: { artifactId: true },
  });
  const descendants = new Set(artifactIds);
  for (const { artifactId } of rows) descendants.add(artifactId);
  return descendants;
};

export const fetchArtifactTreeAround = async (descendantIds: string[]): Promise<TreeAround> => {
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
      artifactPlacementsAsArtifact: {
        select: { containerArtifactId: true, access: true },
      },
      artifactPermissions: { select: { id: true } },
    },
  });

  const artifacts = new Map<string, ArtifactNode>();
  const directPermissions = new Map<string, string[]>();
  const externalParentIds = new Set<string>();

  for (const row of rows) {
    artifacts.set(row.id, { ...row, placements: row.artifactPlacementsAsArtifact });
    if (row.artifactPermissions.length > 0) {
      directPermissions.set(
        row.id,
        row.artifactPermissions.map((permission) => permission.id),
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
    const activeParents = await db.artifact.findMany({
      where: { id: { in: [...externalParentIds] } },
      select: {
        id: true,
        kind: true,
        effectiveAccess: true,
        ownerModel: true,
        userId: true,
        organizationId: true,
        spaceId: true,
        artifactAncestorsAsDescendant: {
          select: { ancestorArtifactId: true, inherits: true, depth: true },
        },
        artifactEffectivePermissions: { select: { artifactPermissionId: true } },
      },
    });
    for (const parent of activeParents) {
      externalParents.set(parent.id, parent);
      if (parent.artifactAncestorsAsDescendant.length > 0) {
        externalAncestors.set(
          parent.id,
          new Map(
            parent.artifactAncestorsAsDescendant.map((row) => [
              row.ancestorArtifactId,
              { inherits: row.inherits, depth: row.depth },
            ]),
          ),
        );
      }
      if (parent.artifactEffectivePermissions.length > 0) {
        externalPermissions.set(
          parent.id,
          parent.artifactEffectivePermissions.map((row) => row.artifactPermissionId),
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
