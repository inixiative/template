/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */

import { createBetterAuthClient } from '@template/ui/lib/auth/createBetterAuthClient';

export const requestPasswordReset = async (email: string): Promise<void> => {
  const { error } = await createBetterAuthClient().requestPasswordReset({ email });
  if (error) throw new Error(error.message || error.statusText);
};
