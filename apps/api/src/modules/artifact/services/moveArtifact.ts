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
import { sameArtifactOwner, withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import {
  assertEdgeAuthority,
  fetchArtifact,
  removePlacement,
  writePlacement,
} from '#/modules/artifact/services/artifactPlacementHelpers';
import { canActOnArtifact } from '#/modules/artifact/services/checkArtifactPermission';

export type MoveArtifactInput = {
  artifactId: string;
  fromContainerArtifactId?: string;
  toContainerArtifactId?: string;
};

export const moveArtifact = async (
  permix: Permix,
  { artifactId, fromContainerArtifactId, toContainerArtifactId }: MoveArtifactInput,
): Promise<Artifact> => {
  const assertMoveAuthority = async (
    member: Artifact,
    fromContainer?: Artifact,
    toContainer?: Artifact,
  ) => {
    if (fromContainer) {
      await assertEdgeAuthority(permix, member, fromContainer, 'remove');
      // why: cross-owner remove skips member auth only when the edge actually sits in fromContainer.
      if (!sameArtifactOwner(member, fromContainer)) {
        const edge = await db.artifactPlacement.findFirst({
          where: { artifactId: member.id, containerArtifactId: fromContainer.id },
          select: { id: true },
        });
        if (!edge) {
          if (!(await canActOnArtifact(permix, member, 'read'))) {
            throw makeError({ status: 403, message: 'Forbidden' });
          }
          throw makeError({ status: 404, message: 'The artifact is not in that container' });
        }
      }
    }
    if (toContainer) await assertEdgeAuthority(permix, member, toContainer, 'create');
    if (!fromContainer && !toContainer) {
      if (!(await canActOnArtifact(permix, member, 'manage'))) {
        throw makeError({ status: 403, message: 'Forbidden' });
      }
    }
  };

  const member = await fetchArtifact(artifactId);
  const fromContainer = fromContainerArtifactId
    ? await fetchArtifact(fromContainerArtifactId)
    : undefined;
  const toContainer = toContainerArtifactId
    ? await fetchArtifact(toContainerArtifactId)
    : undefined;
  await assertMoveAuthority(member, fromContainer, toContainer);
  if (fromContainerArtifactId === toContainerArtifactId) {
    throw makeError({ status: 422, message: 'A move needs a different destination' });
  }

  const lockTargets = [
    member,
    ...(fromContainer ? [fromContainer] : []),
    ...(toContainer ? [toContainer] : []),
  ];
  return withLockedArtifacts(lockTargets, async (locked) => {
    const lockedMember = locked.get(artifactId)!;
    const lockedFrom = fromContainerArtifactId ? locked.get(fromContainerArtifactId)! : undefined;
    const lockedTo = toContainerArtifactId ? locked.get(toContainerArtifactId)! : undefined;
    await assertMoveAuthority(lockedMember, lockedFrom, lockedTo);
    if (lockedTo) await writePlacement(lockedMember, lockedTo, undefined);
    if (lockedFrom) await removePlacement(artifactId, lockedFrom.id);
    return db.artifact.findUniqueOrThrow({ where: { id: artifactId } });
  });
};
