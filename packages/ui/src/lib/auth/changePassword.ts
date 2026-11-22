/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { meChangePassword } from '@template/sdk';
import { makeAuthenticatedApiFetch } from '@template/ui/lib/makeAuthenticatedApiFetch';

export type ChangePasswordInput = { currentPassword: string; newPassword: string };

export const changePassword = async (body: ChangePasswordInput) => {
  const { data } = await makeAuthenticatedApiFetch((requestOptions) =>
    meChangePassword({ ...requestOptions, body, throwOnError: true }),
  )();
  return data;
};
