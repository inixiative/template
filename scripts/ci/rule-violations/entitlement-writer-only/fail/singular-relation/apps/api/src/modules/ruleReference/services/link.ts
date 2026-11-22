import { db } from '@template/db';
export const link = (data: object) =>
  db.ruleReference.create({ data: { targetModel: 'Space', sourceEntitlement: { create: data } } });
