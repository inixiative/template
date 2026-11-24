/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { sameArtifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { canActOnArtifact } from '#/modules/artifact/lib/checkArtifactPermission';

const loadArtifact = async (artifact: string | Artifact): Promise<Artifact> => {
  if (typeof artifact !== 'string') return artifact;
  const row = await db.artifact.findUnique({ where: { id: artifact } });
  if (!row) throw makeError({ status: 404, message: 'Artifact not found' });
  return row;
};

export const assertEdgeAuthority = async (
  permix: Permix,
  memberOrId: string | Artifact,
  containerOrId: string | Artifact,
  mode: 'create' | 'remove' = 'create',
): Promise<void> => {
  const member = await loadArtifact(memberOrId);
  const container = await loadArtifact(containerOrId);
  if (!(await canActOnArtifact(permix, container, 'operate'))) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
  const sameOwner = sameArtifactOwner(member, container);
  if (!sameOwner && mode === 'remove') return;
  const requiredOnMember = sameOwner ? 'manage' : 'read';
  if (!(await canActOnArtifact(permix, member, requiredOnMember))) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
};
