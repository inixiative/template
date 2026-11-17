import { db } from '@template/db';
export const adopt = (id: string, targetEntitlements: object) =>
  db.token.update({ where: { id }, data: { targetEntitlements } });
