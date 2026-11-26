/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { ArtifactKind } from '@template/db/generated/client/enums';
import {
  artifactOwner,
  fetchOwnerRootArtifactOrThrow,
  type OwnedArtifact,
  ownerColumns,
  sameArtifactOwner,
} from '#/modules/artifact/services/artifactOwner';

export const reparentOrphanedArtifacts = async (artifactIds: string[]): Promise<Set<string>> => {
  const uniqueIds = [...new Set(artifactIds)];
  const reparentedIds = new Set<string>();
  if (uniqueIds.length === 0) return reparentedIds;

  await db.withoutDeleted(async () => {
    const activeArtifacts = await db.artifact.findMany({
      where: { id: { in: uniqueIds }, kind: { not: ArtifactKind.root } },
      select: {
        id: true,
        ownerModel: true,
        userId: true,
        organizationId: true,
        spaceId: true,
        artifactPlacementsAsArtifact: {
          select: {
            containerArtifact: {
              select: { ownerModel: true, userId: true, organizationId: true, spaceId: true },
            },
          },
        },
      },
    });

    const byOwner = new Map<string, { ownerFields: OwnedArtifact; orphanIds: string[] }>();
    for (const artifact of activeArtifacts) {
      if (
        artifact.artifactPlacementsAsArtifact.some((p) =>
          sameArtifactOwner(p.containerArtifact, artifact),
        )
      ) {
        continue;
      }
      const { ownerModel, ownerId } = artifactOwner(artifact);
      const key = `${ownerModel}:${ownerId}`;
      const group = byOwner.get(key) ?? { ownerFields: ownerColumns(artifact), orphanIds: [] };
      group.orphanIds.push(artifact.id);
      byOwner.set(key, group);
    }

    const sortedGroups = [...byOwner.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [, { ownerFields, orphanIds }] of sortedGroups) {
      const root = await fetchOwnerRootArtifactOrThrow(ownerFields);
      const created = await db.artifactPlacement.createManyAndReturn({
        data: orphanIds.map((id) => ({
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
