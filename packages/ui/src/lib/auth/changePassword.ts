/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { meChangePassword } from '@template/sdk';
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import { storeJwtHandoff } from '@template/ui/lib/auth/storeJwtHandoff';

export type ChangePasswordInput = { currentPassword: string; newPassword: string };

export const changePassword = async (body: ChangePasswordInput): Promise<void> => {
  const { data } = await apiFetchInternal((requestOptions) =>
    meChangePassword({ ...requestOptions, body, throwOnError: true }),
  )();
  storeJwtHandoff(data);
};
