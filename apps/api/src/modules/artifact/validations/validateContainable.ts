/**
 * @atlas
 * @kind validation
 * @partOf feature:files
 * @uses none
 */
import type { Artifact } from '@template/db/generated/client/client';
import { canContain } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';

export const validateContainable = (
  container: Pick<Artifact, 'id' | 'kind'>,
  target: Pick<Artifact, 'id' | 'kind'>,
): void => {
  if (container.id === target.id) {
    throw makeError({ status: 422, message: 'An artifact cannot contain itself' });
  }
  if (!canContain(container.kind, target.kind)) {
    throw makeError({
      status: 422,
      message: `A ${container.kind} cannot contain a ${target.kind}`,
    });
  }
};
