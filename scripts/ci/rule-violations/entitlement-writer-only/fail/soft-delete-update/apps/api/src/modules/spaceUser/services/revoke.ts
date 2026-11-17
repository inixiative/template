import { db } from '@template/db';
export const revoke = (id: string) => db.entitlement.updateManyAndReturn({ where: { id }, data: { deletedAt: new Date() } });
