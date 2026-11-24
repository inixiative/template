/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses none
 */
import type { Artifact } from '@template/db/generated/client/client';
import { canContain } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';

type Placed = Pick<Artifact, 'id' | 'kind'>;

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
};
