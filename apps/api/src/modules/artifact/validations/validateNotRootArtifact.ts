/**
 * @atlas
 * @kind validation
 * @partOf feature:files
 * @uses none
 */
import type { Artifact } from '@template/db/generated/client/client';
import { isRootKind } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';

export const validateNotRootArtifact = (
  artifact: Pick<Artifact, 'kind'>,
  message = 'Root container cannot be modified directly',
): void => {
  if (isRootKind(artifact.kind)) {
    throw makeError({ status: 422, message });
  }
};
