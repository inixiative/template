/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses none
 */
import type { Artifact } from '@template/db/generated/client/client';
import { artifactKindDef, canContain } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';

type Placed = Pick<
  Artifact,
  'id' | 'kind' | 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'
>;

const sameOwner = (a: Placed, b: Placed) =>
  a.ownerModel === b.ownerModel &&
  a.userId === b.userId &&
  a.organizationId === b.organizationId &&
  a.spaceId === b.spaceId;

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
  if (!sameOwner(container, member) && artifactKindDef(member.kind)?.crossOwner !== 'edge') {
    throw makeError({
      status: 422,
      message: `A ${member.kind} cannot sit in another owner's container; copy it instead`,
    });
  }
};
