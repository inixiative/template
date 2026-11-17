import { db } from '@template/db';
const MODEL = 'Entitlement';
export const copyRows = (data: object[]) => db.delegate(MODEL).createMany({ data });
