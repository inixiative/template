/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';

export const listExclusiveContents = (containerArtifactId: string): Promise<Artifact[]> =>
  db.artifact.findMany({
    where: {
      containers: {
        some: { containerArtifactId },
        none: { containerArtifactId: { not: containerArtifactId } },
      },
    },
    orderBy: { name: 'asc' },
  });
