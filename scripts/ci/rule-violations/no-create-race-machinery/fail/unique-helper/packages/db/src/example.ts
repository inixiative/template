import { db, isUniqueConstraintError } from '@template/db';

export const ensureUser = async (email: string) => {
  try {
    return await db.user.create({ data: { email, name: email } });
  } catch (err) {
    if (isUniqueConstraintError(err)) return db.user.findUnique({ where: { email } });
    throw err;
  }
};
