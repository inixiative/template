/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { listSoleMembers } from '#/modules/artifact/services/listSoleMembers';

export const listExclusiveContents = async (containerArtifactId: string): Promise<Artifact[]> => {
  const container = await db.artifact.findUniqueOrThrow({ where: { id: containerArtifactId } });
  return listSoleMembers(container);
};
