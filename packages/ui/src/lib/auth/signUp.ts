/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */
import { signIn } from '@template/ui/lib/auth/signIn';
import { storeJwtHandoff } from '@template/ui/lib/auth/storeJwtHandoff';
import { throwBetterAuthError } from '@template/ui/lib/auth/throwBetterAuthError';
import { clearToken } from '@template/ui/lib/auth/token';
import type { AuthMethod, EmailAuthMethod, SignUpResult } from '@template/ui/lib/auth/types';
import type { BetterAuthClient } from '@template/ui/store/types/auth';

const signUpWithEmail = async (
  client: BetterAuthClient,
  method: EmailAuthMethod,
): Promise<SignUpResult> => {
  if (!method.name) {
    throw new Error('Name is required for signup');
  }

  const { data, error } = await client.signUp.email({
    email: method.email,
    password: method.password,
    name: method.name,
  });

  if (error) throwBetterAuthError(error);

  if (!data?.token) {
    if (data?.token === null && data.user?.emailVerified === false) {
      clearToken();
      return { status: 'verification-pending', email: method.email };
    }
    throw new Error('No token returned from sign up');
  }

  storeJwtHandoff(data);
  return { status: 'authenticated' };
};

export const signUp = async (
  client: BetterAuthClient,
  method: AuthMethod,
): Promise<SignUpResult> => {
  if (method.type === 'email') return signUpWithEmail(client, method);
  return signIn(client, method);
};
