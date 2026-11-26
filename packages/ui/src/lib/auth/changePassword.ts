/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { meChangePassword } from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';

export type ChangePasswordInput = { currentPassword: string; newPassword: string };

export const changePassword = async (body: ChangePasswordInput) => {
  const { data } = await apiMutation((opts: Parameters<typeof meChangePassword>[0]) =>
    meChangePassword({ ...opts, throwOnError: true }),
  )({ body });
  return data;
};
