/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Artifact, ArtifactPermission } from '@template/db/generated/client/client';

export const ARTIFACT_MAX_DEPTH = 10;

export type ArtifactNode = Artifact & {
  permissions: ArtifactPermission[];
  containerArtifactIds: string[];
};

export type ArtifactGraph = Map<string, ArtifactNode>;

export type FetchArtifactGraphOptions = {
  deletedAtByArtifactId?: Map<string, Date>;
};

const diedWith = (childDeletedAt: Date | null, parentDeletedAt: Date | null): boolean =>
  childDeletedAt == null ||
  (parentDeletedAt != null && childDeletedAt.getTime() === parentDeletedAt.getTime());

const loadFrontierLive = async (frontier: string[]) =>
  db.artifact.findMany({
    where: { id: { in: frontier } },
    include: {
      permissions: true,
      placements: { select: { containerArtifactId: true, deletedAt: true } },
    },
  });

const loadFrontierWithTombstones = async (frontier: string[], tombstones: Date[]) =>
  db.withDeleted(() =>
    db.artifact.findMany({
      where: {
        id: { in: frontier },
        OR: [{ deletedAt: null }, { deletedAt: { in: tombstones } }],
      },
      include: {
        permissions: {
          where: { OR: [{ deletedAt: null }, { deletedAt: { in: tombstones } }] },
        },
        placements: {
          where: { OR: [{ deletedAt: null }, { deletedAt: { in: tombstones } }] },
          select: { containerArtifactId: true, deletedAt: true },
        },
      },
    }),
  );

export const fetchArtifactGraph = async (
  artifactIds: string[],
  options?: FetchArtifactGraphOptions,
): Promise<ArtifactGraph> => {
  const deletedAtByArtifactId = options?.deletedAtByArtifactId;
  const tombstones = deletedAtByArtifactId ? [...deletedAtByArtifactId.values()] : [];
  const graph: ArtifactGraph = new Map();
  let frontier = [...new Set(artifactIds)];
  for (let depth = 0; frontier.length > 0 && depth <= ARTIFACT_MAX_DEPTH + 1; depth++) {
    const artifacts =
      tombstones.length > 0
        ? await loadFrontierWithTombstones(frontier, tombstones)
        : await loadFrontierLive(frontier);
    const next = new Set<string>();
    for (const { placements, permissions, ...artifact } of artifacts) {
      const expectedDeletedAt = deletedAtByArtifactId?.get(artifact.id) ?? artifact.deletedAt;
      const livePlacements = placements.filter((placement) =>
        diedWith(placement.deletedAt, expectedDeletedAt),
      );
      const livePermissions = permissions.filter((permission) =>
        diedWith(permission.deletedAt, expectedDeletedAt),
      );
      const containerArtifactIds = livePlacements.map((placement) => placement.containerArtifactId);
      graph.set(artifact.id, { ...artifact, permissions: livePermissions, containerArtifactIds });
      for (const id of containerArtifactIds) if (!graph.has(id)) next.add(id);
    }
    frontier = [...next];
  }
  return graph;
};
