import { db } from '@template/db';
export const writeSelfGrant = (data: object[]) => db.entitlement.createManyAndReturn({ data });
