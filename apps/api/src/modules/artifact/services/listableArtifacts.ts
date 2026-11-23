/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { Artifact } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { canActOnArtifact } from '#/modules/artifact/lib/checkArtifactPermission';

export const listableArtifacts = async <T extends Artifact>(
  permix: Permix,
  artifacts: T[],
): Promise<T[]> => {
  const checks = await Promise.all(
    artifacts.map((artifact) => canActOnArtifact(permix, artifact, 'read')),
  );
  return artifacts.filter((_, index) => checks[index]);
};
