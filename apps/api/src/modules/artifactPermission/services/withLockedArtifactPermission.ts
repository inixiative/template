/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db, type HydratedRecord, hydrate } from '@template/db';
import type { ArtifactPermission } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';
import { withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';

export const withLockedArtifactPermission = async <T>(
  permission: ArtifactPermission,
  fn: (current: ArtifactPermission, hydratedArtifact: HydratedRecord) => Promise<T>,
): Promise<T> => {
  const artifact = await db.artifact.findUnique({ where: { id: permission.artifactId } });
  if (!artifact) throw makeError({ status: 404, message: 'Artifact not found' });
  return withLockedArtifacts([artifact], async (locked) => {
    const target = locked.get(artifact.id)!;
    const current = await db.artifactPermission.findUnique({ where: { id: permission.id } });
    if (!current || current.artifactId !== target.id) {
      throw makeError({ status: 404, message: 'ArtifactPermission not found' });
    }
    return fn(current, await hydrate('artifact', target));
  });
};
