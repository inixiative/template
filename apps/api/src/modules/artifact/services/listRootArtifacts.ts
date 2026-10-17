/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import type { Artifact } from '@template/db/generated/client/client';
import type { OwnerRef } from '#/modules/artifact/lib/artifactOwner';
import { findOwnerRoot } from '#/modules/artifact/services/ensureOwnerRoot';
import { listSoleMembers } from '#/modules/artifact/services/listSoleMembers';

export const listRootArtifacts = async (owner: OwnerRef): Promise<Artifact[]> => {
  const root = await findOwnerRoot(owner);
  return root ? listSoleMembers(root) : [];
};
