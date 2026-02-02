import type { Db, OrganizationId } from '@template/db/index';
import { Role } from '@template/db/generated/client/enums';
import { HTTPException } from 'hono/http-exception';

export const validateNotLastOwner = async (db: Db, orgId: OrganizationId) => {
  const ownerCount = await db.organizationUser.count({
    where: { organizationId: orgId, role: Role.owner },
  });
  if (ownerCount === 1) throw new HTTPException(400, { message: 'Cannot remove last owner' });
};
