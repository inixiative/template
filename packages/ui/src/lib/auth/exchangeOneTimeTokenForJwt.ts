/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */
import { storeJwtHandoff } from '@template/ui/lib/auth/storeJwtHandoff';
import { throwBetterAuthError } from '@template/ui/lib/auth/throwBetterAuthError';
import type { BetterAuthClient } from '@template/ui/store/types/auth';

export const exchangeOneTimeTokenForJwt = async (
  client: BetterAuthClient,
  oneTimeToken: string,
): Promise<void> => {
  const { data, error } = await client.oneTimeToken.verify({ token: oneTimeToken });

  if (error) throwBetterAuthError(error);

  storeJwtHandoff(data);
};
