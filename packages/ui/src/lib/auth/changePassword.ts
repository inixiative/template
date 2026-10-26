/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { meChangePassword } from '@template/sdk';
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';

export type ChangePasswordInput = { currentPassword: string; newPassword: string };

export const changePassword = async (body: ChangePasswordInput) => {
  const { data } = await apiFetchInternal((requestOptions) =>
    meChangePassword({ ...requestOptions, body, throwOnError: true }),
  )();
  return data;
};
