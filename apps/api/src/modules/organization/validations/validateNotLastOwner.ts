/**
 * @atlas
 * @kind validator
 * @partOf feature:tenancy
 * @uses none
 */

import { db, type OrganizationId } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';

export const validateNotLastOwner = async (orgId: OrganizationId) => {
  const ownerCount = await db.organizationUser.count({
    where: { organizationId: orgId, role: Role.owner },
  });
  if (ownerCount === 1) {
    throw makeError({ status: 400, message: 'Cannot remove last owner' });
  }
};
