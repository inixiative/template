/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */

import { createBetterAuthClient } from '@template/ui/lib/auth/createBetterAuthClient';

export type ResetPasswordInput = { token: string; newPassword: string };

export type ResetPasswordOutcome = 'reset' | 'linkInvalid';

export const resetPassword = async ({
  token,
  newPassword,
}: ResetPasswordInput): Promise<ResetPasswordOutcome> => {
  const { error } = await createBetterAuthClient().resetPassword({ token, newPassword });
  if (!error) return 'reset';
  if (error.code === 'INVALID_TOKEN') return 'linkInvalid';
  throw new Error(error.message || error.statusText);
};
