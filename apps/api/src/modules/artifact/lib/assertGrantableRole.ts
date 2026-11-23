/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { Role } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { roleExceeds } from '#/modules/artifact/lib/artifactRoles';
import type { ArtifactAccessVerdict } from '#/modules/artifact/services/checkArtifactAccess';

export const assertGrantableRole = (
  verdict: ArtifactAccessVerdict | undefined,
  ...roles: Role[]
) => {
  for (const role of roles) {
    if (!verdict?.role || roleExceeds(role, verdict.role)) {
      throw makeError({
        status: 403,
        message: `Cannot change a ${role} grant: it exceeds your own access`,
      });
    }
  }
};
