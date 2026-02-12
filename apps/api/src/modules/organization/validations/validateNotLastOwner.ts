import { Role } from '@template/db/generated/client/enums';
import type { Db, OrganizationId } from '@template/db/index';
import { makeError } from '#/lib/errors';

export const validateNotLastOwner = async (db: Db, orgId: OrganizationId, requestId: string) => {
  const ownerCount = await db.organizationUser.count({
    where: { organizationId: orgId, role: Role.owner },
  });
  if (ownerCount === 1) {
    throw makeError({ status: 400, message: 'Cannot remove last owner', requestId });
  }
};
