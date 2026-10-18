/**
 * @atlas
 * @kind service
 * @partOf feature:users, feature:auth
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';

// Every person JWT carries the user's jwtVersion; a new version refuses all of them.
export const signOutEverywhere = async (userId: string): Promise<void> => {
  await db.user.update({ where: { id: userId }, data: { jwtVersion: { increment: 1 } } });
};
