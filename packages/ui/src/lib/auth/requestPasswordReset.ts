/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */
import { RESET_PASSWORD_PATH } from '@template/ui/lib/routeRedirect';
import type { BetterAuthClient } from '@template/ui/store/types/auth';

export const requestPasswordReset = async (
  client: BetterAuthClient,
  email: string,
): Promise<void> => {
  const { error } = await client.requestPasswordReset({
    email,
    redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}`,
  });
  if (error) throw new Error(error.message || error.statusText);
};
