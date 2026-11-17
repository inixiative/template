import { db } from '@template/db';
const MODEL = 'Entitlement';
export const list = (targetId: string) => db.delegate(MODEL).findMany({ where: { targetId } });
export const count = () => db['entitlement'].count();
export const withAnchor = (id: string) =>
  db.ruleReference.findUnique({ where: { id }, include: { sourceEntitlement: { select: { id: true } } } });
export const holders = (id: string) =>
  db.token.findMany({ where: { id }, include: { targetEntitlements: true } });
