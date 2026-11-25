/**
 * @atlas
 * @kind validation
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { ArtifactKind } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/services/artifactOwner';

export const validateArtifactCreateAtOwner = async (
  permix: Permix,
  kind: ArtifactKind,
  owner: OwnerRef,
  action: 'create' | 'manage' = 'create',
): Promise<void> => {
  const allowed = await holdsOnRecord(
    permix,
    'artifact',
    { id: '', kind, effectiveAccess: 'private', ...ownerColumns(owner) },
    action,
  );
  if (!allowed) throw makeError({ status: 403, message: 'Forbidden' });
};
