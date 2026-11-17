import { db } from '@template/db';
export const grant = (data: object) => {
  const { entitlement: rows } = db;
  return rows.create({ data });
};
