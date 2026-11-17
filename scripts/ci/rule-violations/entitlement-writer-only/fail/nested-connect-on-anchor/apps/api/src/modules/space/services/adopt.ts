import { db } from '@template/db';
export const adopt = (id: string, rowId: string) =>
  db.space.update({ where: { id }, data: { sourceEntitlements: { connect: { id: rowId } } } as never });
