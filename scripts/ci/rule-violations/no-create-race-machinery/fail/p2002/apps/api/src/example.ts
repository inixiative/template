import { db } from '@template/db';

export const ensureUser = async (email: string) => {
  try {
    return await db.user.create({ data: { email, name: email } });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return db.user.findUnique({ where: { email } });
    throw err;
  }
};
