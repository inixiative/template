/**
 * @atlas
 * @kind validation
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { hydrate } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { Role } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { check } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';

export const validateArtifactPermissionGrant = async (
  permix: Permix,
  artifact: Artifact,
  role: Role,
): Promise<void> => {
  const hydrated = await hydrate('artifact', artifact);
  const allowed = check(
    permix,
    'artifactPermission',
    { id: '', artifactId: artifact.id, role, artifact: hydrated },
    'create',
  );
  if (!allowed) throw makeError({ status: 403, message: 'Forbidden' });
};
