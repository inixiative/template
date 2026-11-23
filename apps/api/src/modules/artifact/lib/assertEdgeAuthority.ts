/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { Permix } from '@template/permissions/client';
import { assertArtifactPermission } from '#/modules/artifact/lib/checkArtifactPermission';

export const assertEdgeAuthority = async (
  permix: Permix,
  artifactId: string,
  containerArtifactId: string,
): Promise<void> => {
  await assertArtifactPermission(permix, artifactId, 'manage');
  await assertArtifactPermission(permix, containerArtifactId, 'operate');
};
