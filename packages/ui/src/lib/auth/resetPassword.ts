/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */
import type { BetterAuthClient } from '@template/ui/store/types/auth';

export type ResetPasswordInput = { token: string; newPassword: string };

export type ResetPasswordOutcome = 'reset' | 'linkInvalid';

export const resetPassword = async (
  client: BetterAuthClient,
  { token, newPassword }: ResetPasswordInput,
): Promise<ResetPasswordOutcome> => {
  const { error } = await client.resetPassword({ token, newPassword });
  if (!error) return 'reset';
  if (error.code === 'INVALID_TOKEN') return 'linkInvalid';
  throw new Error(error.message || error.statusText);
};
