/**
 * @atlas
 * @kind validation
 * @partOf feature:files
 * @uses none
 */
import type { Artifact } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import { isRootKind } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';

export const defaultPlacementAccess = (container: Pick<Artifact, 'kind'>): ArtifactAccess =>
  isRootKind(container.kind) ? 'private' : 'inherit';

export const validatePlacementAccess = (
  container: Pick<Artifact, 'kind'>,
  access: ArtifactAccess,
): void => {
  if (isRootKind(container.kind) && access === 'inherit') {
    throw makeError({
      status: 422,
      message: 'Root placements cannot use inherit access; choose private, tenant, or public',
    });
  }
};
