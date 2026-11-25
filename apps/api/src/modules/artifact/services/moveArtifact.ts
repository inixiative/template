/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { sameArtifactOwner, withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import {
  assertEdgeAuthority,
  assertPlacementDeletable,
  fetchArtifact,
  writePlacement,
} from '#/modules/artifact/services/artifactPlacementHelpers';
import { canActOnArtifact } from '#/modules/artifact/services/checkArtifactPermission';
import {
  assertNotRootArtifact,
  ensureOwnerRootArtifact,
  fetchOwnerRootArtifact,
} from '#/modules/artifact/services/ownerRootArtifact';

export type MoveArtifactInput = {
  artifactId: string;
  fromContainerArtifactId?: string;
  toContainerArtifactId?: string;
  access?: ArtifactAccess;
};

const assertAndFetchSourcePlacement = async (
  permix: Permix,
  member: Artifact,
  fromContainer: Artifact,
): Promise<ArtifactPlacement> => {
  await assertEdgeAuthority(permix, member, fromContainer, 'remove');
  const edge = await db.artifactPlacement.findFirst({
    where: { artifactId: member.id, containerArtifactId: fromContainer.id },
  });
  if (!edge) {
    if (
      !sameArtifactOwner(member, fromContainer) &&
      !(await canActOnArtifact(permix, member, 'read'))
    ) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
    throw makeError({ status: 404, message: 'The artifact is not in that container' });
  }
  await assertPlacementDeletable(permix, edge);
  return edge;
};

const assertMovePairValid = (member: Artifact, fromContainer: Artifact, toContainer: Artifact) => {
  if (fromContainer.id === toContainer.id) {
    throw makeError({ status: 422, message: 'A move needs a different destination' });
  }
  if (sameArtifactOwner(member, fromContainer) && !sameArtifactOwner(member, toContainer)) {
    throw makeError({
      status: 422,
      message:
        'Cannot move an artifact out of its own workspace into another owner; use place or transfer instead',
    });
  }
};

export const moveArtifact = async (
  permix: Permix,
  { artifactId, fromContainerArtifactId, toContainerArtifactId, access }: MoveArtifactInput,
): Promise<Artifact> => {
  const member = await fetchArtifact(artifactId);
  assertNotRootArtifact(member, 'Root container cannot be moved');

  if (!fromContainerArtifactId && !toContainerArtifactId) {
    if (!(await canActOnArtifact(permix, member, 'manage'))) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
    throw makeError({ status: 422, message: 'A move needs a different destination' });
  }

  // Gate container lookups when the caller cannot even read the member (prevents container existence oracle).
  if (
    !(await canActOnArtifact(permix, member, 'read')) &&
    (!fromContainerArtifactId ||
      !(await canActOnArtifact(permix, await fetchArtifact(fromContainerArtifactId), 'operate')))
  ) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }

  const resolvedFrom = fromContainerArtifactId
    ? await fetchArtifact(fromContainerArtifactId)
    : await fetchOwnerRootArtifact(member);
  if (!resolvedFrom) {
    if (!(await canActOnArtifact(permix, member, 'manage'))) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
    throw makeError({ status: 404, message: 'The artifact is not in that container' });
  }

  const resolvedTo = toContainerArtifactId
    ? await fetchArtifact(toContainerArtifactId)
    : await fetchOwnerRootArtifact(member);

  if (resolvedTo) {
    await assertAndFetchSourcePlacement(permix, member, resolvedFrom);
    await assertEdgeAuthority(permix, member, resolvedTo, 'create', access);
    assertMovePairValid(member, resolvedFrom, resolvedTo);

    return withLockedArtifacts([member, resolvedFrom, resolvedTo], async (locked) => {
      const lockedMember = locked.get(artifactId)!;
      const lockedFrom = locked.get(resolvedFrom.id)!;
      const lockedTo = locked.get(resolvedTo.id)!;
      assertNotRootArtifact(lockedMember, 'Root container cannot be moved');
      const sourceEdge = await assertAndFetchSourcePlacement(permix, lockedMember, lockedFrom);
      await assertEdgeAuthority(permix, lockedMember, lockedTo, 'create', access);
      assertMovePairValid(lockedMember, lockedFrom, lockedTo);
      await writePlacement(lockedMember, lockedTo, access);
      await db.artifactPlacement.update({
        where: { id: sourceEdge.id },
        data: { deletedAt: new Date() },
      });
      return db.artifact.findUniqueOrThrow({ where: { id: artifactId } });
    });
  }

  // Moving to member's root when root does not exist yet: check authority first, then create root under lock.
  await assertAndFetchSourcePlacement(permix, member, resolvedFrom);
  if (!(await canActOnArtifact(permix, member, 'manage'))) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
  return withLockedArtifacts([member, resolvedFrom], async (locked) => {
    const lockedMember = locked.get(artifactId)!;
    const lockedFrom = locked.get(resolvedFrom.id)!;
    assertNotRootArtifact(lockedMember, 'Root container cannot be moved');
    const sourceEdge = await assertAndFetchSourcePlacement(permix, lockedMember, lockedFrom);
    const targetRoot = await ensureOwnerRootArtifact(lockedMember);
    await assertEdgeAuthority(permix, lockedMember, targetRoot, 'create', access);
    assertMovePairValid(lockedMember, lockedFrom, targetRoot);
    await writePlacement(lockedMember, targetRoot, access);
    await db.artifactPlacement.update({
      where: { id: sourceEdge.id },
      data: { deletedAt: new Date() },
    });
    return db.artifact.findUniqueOrThrow({ where: { id: artifactId } });
  });
};
