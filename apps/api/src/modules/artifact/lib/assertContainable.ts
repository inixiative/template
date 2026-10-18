/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses none
 */
import type { Artifact } from '@template/db/generated/client/client';
import { canContain } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import { sameArtifactOwner } from '#/modules/artifact/lib/artifactOwner';

type Placed = Pick<
  Artifact,
  'id' | 'kind' | 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'
>;

export const assertContainable = (container: Placed, member: Placed): void => {
  if (container.id === member.id) {
    throw makeError({ status: 422, message: 'An artifact cannot contain itself' });
  }
  if (!canContain(container.kind, member.kind)) {
    throw makeError({
      status: 422,
      message: `A ${container.kind} cannot contain a ${member.kind}`,
    });
  }
  if (!sameArtifactOwner(container, member)) {
    throw makeError({
      status: 422,
      message:
        'Placements stay within one owner; to hand an artifact to another owner, transfer it',
    });
  }
};
