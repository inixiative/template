/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { meChangePassword } from '@template/sdk';
import { makeAuthenticatedApiFetch } from '@template/ui/lib/makeAuthenticatedApiFetch';

export type ChangePasswordInput = { currentPassword: string; newPassword: string };

export const changePassword = async (
  body: ChangePasswordInput,
  options?: { spoofUserEmail?: string | null },
) => {
  const { data } = await makeAuthenticatedApiFetch(
    (opts: Parameters<typeof meChangePassword>[0]) =>
      meChangePassword({ ...opts, throwOnError: true }),
    { spoofUserEmail: options?.spoofUserEmail },
  )({ body });
  return data;
};
