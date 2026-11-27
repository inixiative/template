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
  fetchOwnerRootArtifactOrThrow,
  type OwnerRef,
  ownerColumns,
  withLockedArtifacts,
} from '#/modules/artifact/services/artifactOwner';
import {
  fetchArtifactOrThrow,
  insertArtifact,
} from '#/modules/artifact/services/artifactPlacementUtils';
import { validateArtifactCreateAtOwner } from '#/modules/artifact/validations/validateArtifactCreateAtOwner';
import { validateArtifactPermission } from '#/modules/artifact/validations/validateArtifactPermission';
import { validateNotRootArtifact } from '#/modules/artifact/validations/validateNotRootArtifact';

type CopyArtifactInput =
  | { source: Artifact; targetContainerArtifactId: string; name?: string }
  | { source: Artifact; owner: OwnerRef; name?: string };

export const copyArtifactInto = async (
  source: Artifact,
  targetContainer: Artifact,
  name?: string,
): Promise<Artifact> => {
  const copy = await insertArtifact(
    { ...ownerColumns(targetContainer), kind: source.kind, name: name ?? source.name },
    targetContainer,
  );
  if (source.kind === 'file') {
    const file = await db.file.findUnique({
      where: { artifactId: source.id },
      include: { fileVersions: { where: { status: 'active' } } },
    });
    if (file) {
      const copied = await db.file.create({ data: { artifactId: copy.id, sourceFileId: file.id } });
      if (file.fileVersions.length > 0) {
        await db.fileVersion.createManyAndReturn({
          data: file.fileVersions.map((v) => ({
            fileId: copied.id,
            version: v.version,
            key: v.key,
            contentType: v.contentType,
            size: v.size,
            status: 'pending' as const,
          })),
        });
      }
    }
  }
  return copy;
};

export const copyArtifact = async (permix: Permix, input: CopyArtifactInput): Promise<Artifact> => {
  const { source, name } = input;
  validateNotRootArtifact(source, 'Root container cannot be copied');

  let targetContainer: Artifact;
  if ('owner' in input) {
    await validateArtifactCreateAtOwner(permix, source.kind, input.owner);
    targetContainer = await fetchOwnerRootArtifactOrThrow(input.owner);
  } else {
    targetContainer = await fetchArtifactOrThrow(input.targetContainerArtifactId);
    await validateArtifactCreateAtOwner(permix, source.kind, targetContainer);
  }
  await validateArtifactPermission(permix, targetContainer, 'operate');

  return withLockedArtifacts([source, targetContainer], async (locked) => {
    const lockedSource = locked.get(source.id)!;
    const lockedTarget = locked.get(targetContainer.id)!;
    await validateArtifactPermission(permix, lockedSource, 'read');
    await validateArtifactPermission(permix, lockedTarget, 'operate');
    await validateArtifactCreateAtOwner(permix, lockedSource.kind, lockedTarget);
    return copyArtifactInto(lockedSource, lockedTarget, name);
  });
};
