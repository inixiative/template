import { db } from '@template/db';
const rows = db.entitlement;
export const stamp = (ids: string[]) =>
  rows.updateManyAndReturn({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
