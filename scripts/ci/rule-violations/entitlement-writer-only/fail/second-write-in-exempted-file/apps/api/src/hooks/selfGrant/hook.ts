import { db } from '@template/db';
export const writeSelfGrant = (data: object[]) => db.entitlement.createManyAndReturn({ data });
export const dropAll = (targetId: string) => db.entitlement.deleteMany({ where: { targetId } });
