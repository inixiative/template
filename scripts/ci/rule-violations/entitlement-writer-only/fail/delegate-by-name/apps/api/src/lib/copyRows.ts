import { db } from '@template/db';
export const copy = (data: object[]) => db.delegate('Entitlement').createManyAndReturn({ data });
