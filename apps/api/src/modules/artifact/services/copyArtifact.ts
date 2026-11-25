/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import {
  type OwnedArtifact,
  ownerColumns,
  withLockedArtifacts,
} from '#/modules/artifact/services/artifactOwner';
import { insertArtifact } from '#/modules/artifact/services/artifactPlacementUtils';
import { validateArtifactCreateAtOwner } from '#/modules/artifact/validations/validateArtifactCreateAtOwner';
import { validateArtifactPermission } from '#/modules/artifact/validations/validateArtifactPermission';
import { validateNotRootArtifact } from '#/modules/artifact/validations/validateNotRootArtifact';

export type CopyArtifactInput = {
  artifactId: string;
  targetContainerArtifactId: string;
  name?: string;
};

export const copyArtifactInto = async (
  source: Artifact,
  owner: OwnedArtifact,
  { targetContainerArtifactId, name }: { targetContainerArtifactId?: string; name?: string },
): Promise<Artifact> => {
  validateNotRootArtifact(source, 'Root container cannot be copied');
  const copy = await insertArtifact({
    ...ownerColumns(owner),
    kind: source.kind,
    name: name ?? source.name,
    containerArtifactId: targetContainerArtifactId,
  });
  if (source.kind === 'file') {
    const file = await db.file.findUnique({
      where: { artifactId: source.id },
      include: { fileVersions: { where: { status: 'active' } } },
    });
    if (file) {
      const copied = await db.file.create({ data: { artifactId: copy.id, sourceFileId: file.id } });
      for (const version of file.fileVersions) {
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
  { artifactId, targetContainerArtifactId, name }: CopyArtifactInput,
): Promise<Artifact> => {
  const source = await validateArtifactPermission(permix, artifactId, 'read');
  validateNotRootArtifact(source, 'Root container cannot be copied');
  const targetContainer = await validateArtifactPermission(
    permix,
    targetContainerArtifactId,
    'operate',
  );
  await validateArtifactCreateAtOwner(permix, source.kind, targetContainer);
  return withLockedArtifacts([source, targetContainer], async (locked) => {
    const lockedSource = locked.get(artifactId)!;
    const lockedTarget = locked.get(targetContainerArtifactId)!;
    validateNotRootArtifact(lockedSource, 'Root container cannot be copied');
    await validateArtifactPermission(permix, lockedSource, 'read');
    await validateArtifactPermission(permix, lockedTarget, 'operate');
    await validateArtifactCreateAtOwner(permix, lockedSource.kind, lockedTarget);
    return copyArtifactInto(lockedSource, lockedTarget, {
      targetContainerArtifactId: lockedTarget.id,
      name,
    });
  });
};
