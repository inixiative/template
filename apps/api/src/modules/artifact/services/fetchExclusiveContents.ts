/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';

export const fetchExclusiveContents = (containerArtifactId: string): Promise<Artifact[]> =>
  db.artifact.findMany({
    where: {
      placements: { some: { containerArtifactId }, every: { containerArtifactId } },
    },
    orderBy: { name: 'asc' },
  });
