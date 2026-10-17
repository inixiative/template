/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { Role } from '@template/db/generated/client/enums';
import { roleHierarchy } from '@template/permissions';
import { makeError } from '#/lib/errors';
import type { ArtifactAccessVerdict } from '#/modules/artifact/services/checkArtifactAccess';

export const assertGrantableRole = (
  verdict: ArtifactAccessVerdict | undefined,
  ...roles: Role[]
) => {
  for (const role of roles) {
    if (!verdict?.role || roleHierarchy.indexOf(role) > roleHierarchy.indexOf(verdict.role)) {
      throw makeError({
        status: 403,
        message: `Cannot change a ${role} grant: it exceeds your own access`,
      });
    }
  }
};
