/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import {
  type OwnedArtifact,
  ownerColumns,
  withLockedArtifacts,
} from '#/modules/artifact/services/artifactOwner';
import { insertArtifact } from '#/modules/artifact/services/artifactPlacementHelpers';
import {
  assertArtifactPermission,
  canActOnArtifact,
} from '#/modules/artifact/services/checkArtifactPermission';

export type CopyArtifactInput = {
  artifactId: string;
  containerArtifactId: string;
  name?: string;
};

export const copyArtifactInto = async (
  source: Artifact,
  owner: OwnedArtifact,
  { containerArtifactId, name }: { containerArtifactId?: string; name?: string },
): Promise<Artifact> => {
  const copy = await insertArtifact({
    ...ownerColumns(owner),
    kind: source.kind,
    name: name ?? source.name,
    access: containerArtifactId ? 'inherit' : 'private',
    containerArtifactId,
  });
  if (source.kind === 'file') {
    const file = await db.file.findUnique({
      where: { artifactId: source.id },
      include: { versions: { where: { status: 'active' } } },
    });
    if (file) {
      const copied = await db.file.create({ data: { artifactId: copy.id, sourceFileId: file.id } });
      for (const version of file.versions) {
        await db.fileVersion.create({
          data: {
            fileId: copied.id,
            version: version.version,
            key: version.key,
            contentType: version.contentType,
            size: version.size,
            status: 'pending',
          },
        });
      }
    }
  }
  return copy;
};

export const copyArtifact = async (
  permix: Permix,
  { artifactId, containerArtifactId, name }: CopyArtifactInput,
): Promise<Artifact> => {
  const source = await assertArtifactPermission(permix, artifactId, 'read');
  const container = await assertArtifactPermission(permix, containerArtifactId, 'operate');
  return withLockedArtifacts([source, container], async (locked) => {
    const lockedSource = locked.get(artifactId)!;
    const lockedContainer = locked.get(containerArtifactId)!;
    if (!(await canActOnArtifact(permix, lockedSource, 'read'))) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
    if (!(await canActOnArtifact(permix, lockedContainer, 'operate'))) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
    return copyArtifactInto(lockedSource, lockedContainer, {
      containerArtifactId: lockedContainer.id,
      name,
    });
  });
};
