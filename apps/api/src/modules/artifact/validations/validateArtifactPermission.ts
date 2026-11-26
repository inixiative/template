/**
 * @atlas
 * @kind validation
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Artifact } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';

type ArtifactAction = 'own' | 'delete' | 'manage' | 'operate' | 'read';

export const validateArtifactPermission = async (
  permix: Permix,
  artifact: Artifact,
  action: ArtifactAction,
): Promise<void> => {
  if (!(await holdsOnRecord(permix, 'artifact', artifact, action))) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
};
