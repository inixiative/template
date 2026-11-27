/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */
import { throwBetterAuthError } from '@template/ui/lib/auth/throwBetterAuthError';
import type { BetterAuthClient } from '@template/ui/store/types/auth';

export type ResetPasswordInput = { token: string; newPassword: string };

export type ResetPasswordResult = { status: 'passwordReset' | 'linkInvalid' };

export const resetPassword = async (
  client: BetterAuthClient,
  { token, newPassword }: ResetPasswordInput,
): Promise<ResetPasswordResult> => {
  const { error } = await client.resetPassword({ token, newPassword });
  if (!error) return { status: 'passwordReset' };
  if (error.code === 'INVALID_TOKEN') return { status: 'linkInvalid' };
  return throwBetterAuthError(error);
};
