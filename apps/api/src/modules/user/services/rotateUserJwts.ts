/**
 * @atlas
 * @kind service
 * @partOf feature:users, feature:auth
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';

// The one writer of jwtVersion: every user JWT carries it, so a new version refuses all of them.
export const rotateUserJwts = async (userId: string): Promise<void> => {
  await db.user.update({ where: { id: userId }, data: { jwtVersion: { increment: 1 } } });
};
