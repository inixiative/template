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
} from '#/modules/artifact/services/artifactOwner';

export const reparentOrphanedArtifacts = async (artifactIds: string[]): Promise<Set<string>> => {
  const uniqueIds = [...new Set(artifactIds)];
  const reparentedIds = new Set<string>();
  if (uniqueIds.length === 0) return reparentedIds;

  await db.withoutDeleted(async () => {
    const activeArtifacts = await db.artifact.findMany({
      where: { id: { in: uniqueIds }, kind: { not: ArtifactKind.root } },
      select: { id: true, ownerModel: true, userId: true, organizationId: true, spaceId: true },
    });
    if (activeArtifacts.length === 0) return;

    const byOwner = new Map<string, { ownerFields: OwnedArtifact; artifactIds: string[] }>();
    for (const artifact of activeArtifacts) {
      const { ownerModel, ownerId } = artifactOwner(artifact);
      const key = `${ownerModel}:${ownerId}`;
      const group = byOwner.get(key) ?? { ownerFields: ownerColumns(artifact), artifactIds: [] };
      group.artifactIds.push(artifact.id);
      byOwner.set(key, group);
    }

    const sortedGroups = [...byOwner.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [, { ownerFields, artifactIds: candidateIds }] of sortedGroups) {
      const orphans = await db.artifact.findMany({
        where: {
          id: { in: candidateIds },
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
