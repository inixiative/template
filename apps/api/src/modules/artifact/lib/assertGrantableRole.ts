/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { HydratedRecord } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { roleToStandardAction } from '@template/permissions/roles/shared';
import { makeError } from '#/lib/errors';

export const assertGrantableRole = (
  permix: Permix,
  hydratedArtifact: HydratedRecord,
  ...roles: Role[]
): void => {
  if (!check(permix, rebacSchema, 'artifact', hydratedArtifact, 'manage')) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
  for (const role of roles) {
    if (!check(permix, rebacSchema, 'artifact', hydratedArtifact, roleToStandardAction(role))) {
      throw makeError({
        status: 403,
        message: `Cannot change a ${role} grant: it exceeds your own access`,
      });
    }
  }
};
