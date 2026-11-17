import { db } from '@template/db';
export const upsertGrant = (id: string, data: object) => db.entitlement.upsert({ where: { id }, create: data as never, update: {} });
