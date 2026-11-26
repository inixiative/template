/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */

import { betterAuthClient } from '@template/ui/lib/auth/betterAuthClient';

export const requestPasswordReset = async (email: string): Promise<void> => {
  const { error } = await betterAuthClient().requestPasswordReset({ email });
  if (error) throw new Error(error.message || error.statusText);
};
