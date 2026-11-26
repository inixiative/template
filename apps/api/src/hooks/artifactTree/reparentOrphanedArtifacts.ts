/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { ArtifactKind } from '@template/db/generated/client/enums';
import { isRootKind } from '@template/shared/artifact';
import {
  artifactOwner,
  fetchOwnerRootArtifactOrThrow,
  type OwnedArtifact,
  ownerColumns,
  sameArtifactOwner,
} from '#/modules/artifact/services/artifactOwner';

export type RemovedPlacement = {
  artifactId: string;
  containerArtifactId: string;
};

export const reparentOrphanedArtifacts = async (
  removed: RemovedPlacement[],
): Promise<Set<string>> => {
  const reparentedIds = new Set<string>();
  if (removed.length === 0) return reparentedIds;

  await db.withoutDeleted(async () => {
    const artifactIds = [...new Set(removed.map((edge) => edge.artifactId))];
    const containerIds = [...new Set(removed.map((edge) => edge.containerArtifactId))];

    const [activeArtifacts, containers] = await Promise.all([
      db.artifact.findMany({
        where: { id: { in: artifactIds }, kind: { not: ArtifactKind.root } },
        select: { id: true, ownerModel: true, userId: true, organizationId: true, spaceId: true },
      }),
      // why: a container just deleted via DELETE /artifact/:id is already tombstoned when cascade deletes its placements.
      db.withDeleted(() =>
        db.artifact.findMany({
          where: { id: { in: containerIds } },
          select: {
            id: true,
            kind: true,
            ownerModel: true,
            userId: true,
            organizationId: true,
            spaceId: true,
          },
        }),
      ),
    ]);

    const artifactById = new Map(activeArtifacts.map((row) => [row.id, row]));
    const containerById = new Map(containers.map((row) => [row.id, row]));

    const byOwner = new Map<string, { ownerFields: OwnedArtifact; artifactIds: Set<string> }>();
    for (const { artifactId, containerArtifactId } of removed) {
      const artifact = artifactById.get(artifactId);
      const container = containerById.get(containerArtifactId);
      if (!artifact || !container || isRootKind(container.kind)) continue;
      if (!sameArtifactOwner(artifact, container)) continue;
      const { ownerModel, ownerId } = artifactOwner(artifact);
      const key = `${ownerModel}:${ownerId}`;
      const group = byOwner.get(key) ?? {
        ownerFields: ownerColumns(artifact),
        artifactIds: new Set<string>(),
      };
      group.artifactIds.add(artifact.id);
      byOwner.set(key, group);
    }

    const sortedGroups = [...byOwner.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [, { ownerFields, artifactIds: candidateIds }] of sortedGroups) {
      const orphans = await db.artifact.findMany({
        where: {
          id: { in: [...candidateIds] },
          artifactPlacementsAsArtifact: { none: { containerArtifact: ownerFields } },
        },
        select: { id: true },
      });
      if (orphans.length === 0) continue;

      const root = await fetchOwnerRootArtifactOrThrow(ownerFields);
      const created = await db.artifactPlacement.createManyAndReturn({
        data: orphans.map(({ id }) => ({
          containerArtifactId: root.id,
          artifactId: id,
          access: 'private' as const,
        })),
        skipDuplicates: true,
      });
      for (const row of created) reparentedIds.add(row.artifactId);
    }
  });
  return reparentedIds;
};
