import { type ExtendedPrismaClient, type OrganizationId, OrganizationRole } from '@template/db';
import { HTTPException } from 'hono/http-exception';

export const checkNotLastOwner = async (db: ExtendedPrismaClient, orgId: OrganizationId) => {
  const ownerCount = await db.organizationUser.count({
    where: { organizationId: orgId, role: OrganizationRole.owner },
  });
  if (ownerCount === 1) throw new HTTPException(400, { message: 'Cannot remove last owner' });
};
