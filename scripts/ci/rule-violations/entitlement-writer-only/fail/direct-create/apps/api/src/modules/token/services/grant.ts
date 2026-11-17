import { db } from '@template/db';
export const grant = (data: object) => db.entitlement.create({ data: data as never });
