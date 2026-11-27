/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';

const artifactWithTreeEdges = {
  include: { artifactPlacementsAsArtifact: true, artifactPermissions: true },
} satisfies Prisma.ArtifactDefaultArgs;

const externalParentWithMaterialized = {
  include: { artifactAncestorsAsDescendant: true, artifactEffectivePermissions: true },
} satisfies Prisma.ArtifactDefaultArgs;

type ArtifactWithTreeEdges = Prisma.ArtifactGetPayload<typeof artifactWithTreeEdges>;
type ExternalParentWithMaterialized = Prisma.ArtifactGetPayload<
  typeof externalParentWithMaterialized
>;

export type TreeAround = {
  artifacts: Map<string, ArtifactWithTreeEdges>;
  externalParents: Map<string, ExternalParentWithMaterialized>;
};

export const fetchDescendantIds = async (artifactIds: string[]): Promise<Set<string>> => {
  const rows = await db.artifactAncestor.findMany({
    where: { ancestorArtifactId: { in: artifactIds } },
    select: { artifactId: true },
  });
  return new Set([...artifactIds, ...rows.map((row) => row.artifactId)]);
};

export const fetchArtifactTreeAround = async (descendantIds: string[]): Promise<TreeAround> => {
  const rows = await db.artifact.findMany({
    where: { id: { in: descendantIds } },
    ...artifactWithTreeEdges,
  });
  const artifacts = new Map(rows.map((row) => [row.id, row]));

  const externalParentIds = new Set<string>();
  for (const node of artifacts.values()) {
    for (const { containerArtifactId } of node.artifactPlacementsAsArtifact) {
      if (!artifacts.has(containerArtifactId)) externalParentIds.add(containerArtifactId);
    }
  }

  const parents =
    externalParentIds.size > 0
      ? await db.artifact.findMany({
          where: { id: { in: [...externalParentIds] } },
          ...externalParentWithMaterialized,
        })
      : [];

  return {
    artifacts,
    externalParents: new Map(parents.map((parent) => [parent.id, parent])),
  };
};
