/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import type { Context } from 'hono';
import {
  fetchUserHasCredentialPassword,
  verifyUserPasswordOrThrow,
} from '#/lib/auth/verifyUserPassword';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const assertEnrollmentAuthorization = async (
  c: Context<AppEnv>,
  currentPassword: string | undefined,
): Promise<void> => {
  const user = c.get('user')!;
  if (user.twoFactorEnabled) return;

  const hasPassword = await fetchUserHasCredentialPassword(user.id);
  if (!hasPassword) return;
  if (!currentPassword) {
    throw makeError({
      status: 400,
      message: 'Current password is required to enable two-factor authentication',
    });
  }

  await verifyUserPasswordOrThrow(user.id, currentPassword);
};
