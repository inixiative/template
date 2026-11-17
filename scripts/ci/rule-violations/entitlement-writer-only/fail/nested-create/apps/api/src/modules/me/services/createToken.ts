import { db } from '@template/db';
export const createToken = (entitlements: object[]) =>
  db.token.create({ data: { name: 't', targetEntitlements: { createMany: { data: entitlements } } } as never });
