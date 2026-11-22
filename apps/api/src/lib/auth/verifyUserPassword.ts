/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import { db } from '@template/db';
import { auth } from '#/lib/auth';
import { withThrowawaySession } from '#/lib/auth/withThrowawaySession';
import { makeError } from '#/lib/errors';

export const fetchUserHasCredentialPassword = async (userId: string): Promise<boolean> => {
  const account = await db.account.findFirst({
    where: { userId, providerId: 'credential', password: { not: null } },
    select: { id: true },
  });
  return Boolean(account);
};

export const verifyUserPasswordOrThrow = async (
  userId: string,
  password: string,
): Promise<void> => {
  const result = await withThrowawaySession(userId, (headers) =>
    auth.api.verifyPassword({ body: { password }, headers }),
  );
  if (!result?.status) {
    throw makeError({ status: 400, message: 'Invalid password' });
  }
};
