/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { StandardAction } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { roleAllows } from '#/modules/artifact/lib/artifactRoles';
import type { ArtifactAccessVerdict } from '#/modules/artifact/services/checkArtifactAccess';

export const assertArtifactAction = (
  verdict: ArtifactAccessVerdict | undefined,
  action: StandardAction,
): void => {
  if (!verdict || (!verdict.public && !verdict.role)) {
    throw makeError({ status: 404, message: 'Artifact not found' });
  }
  if (!roleAllows(verdict.role, action) && !(action === 'read' && verdict.public)) {
    throw makeError({ status: 403, message: 'Access denied' });
  }
};
