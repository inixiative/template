/**
 * @atlas
 * @kind validation
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db, type HydratedRecord, hydrate } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { ArtifactAction } from '@template/permissions';
import type { Permix } from '@template/permissions/client';
import { check } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';

export const validateArtifactPermission = async (
  permix: Permix,
  artifactOrId: string | Artifact,
  action: ArtifactAction,
): Promise<Artifact & HydratedRecord> => {
  const artifact =
    typeof artifactOrId === 'string'
      ? await db.artifact.findUnique({ where: { id: artifactOrId } })
      : artifactOrId;
  if (!artifact) throw makeError({ status: 404, message: 'Artifact not found' });
  const hydrated = (await hydrate('artifact', artifact)) as Artifact & HydratedRecord;
  if (!check(permix, 'artifact', hydrated, action)) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
  return hydrated;
};
