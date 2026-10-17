/**
 * @atlas
 * @kind helper
 * @partOf feature:files
 * @uses none
 */
import type { Artifact } from '@template/db/generated/client/client';
import { isOwnerRootKind } from '@template/shared/artifact';
import { sameArtifactOwner } from '#/modules/artifact/lib/artifactOwner';

type Owned = Pick<Artifact, 'id' | 'kind' | 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'>;

export const parentsWithRootAsTop = <T extends Owned>(child: Owned, parents: T[]): T[] => {
  const hasOwnParent = parents.some(
    (parent) => !isOwnerRootKind(parent.kind) && sameArtifactOwner(parent, child),
  );
  return hasOwnParent ? parents.filter((parent) => !isOwnerRootKind(parent.kind)) : parents;
};
