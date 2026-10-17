/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';

export const listRootArtifacts = (owner: Prisma.ArtifactWhereInput) =>
  db.artifact.findMany({
    where: { ...owner, containers: { none: {} } },
    orderBy: { name: 'asc' },
  });
