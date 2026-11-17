import { db } from '@template/db';
export const changeEntitlements = async (ids: string[], data: object[]) => {
  await db.entitlement.updateManyAndReturn({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
  await db.entitlement.createManyAndReturn({ data });
};
