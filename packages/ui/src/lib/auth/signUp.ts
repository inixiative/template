/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */
import { signInWithOAuth } from '@template/ui/lib/auth/signIn';
import { storeJwtHandoff } from '@template/ui/lib/auth/storeJwtHandoff';
import { clearToken } from '@template/ui/lib/auth/token';
import type {
  AuthMethod,
  EmailAuthMethod,
  SamlAuthMethod,
  SignUpResult,
} from '@template/ui/lib/auth/types';
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

  if (error) {
    throw new Error(error.message || error.statusText);
  }

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

const signUpWithSaml = async (_method: SamlAuthMethod): Promise<SignUpResult> => {
  throw new Error('SAML authentication not yet implemented');
};

export const signUp = async (
  client: BetterAuthClient,
  method: AuthMethod,
): Promise<SignUpResult> => {
  switch (method.type) {
    case 'email':
      return signUpWithEmail(client, method);
    case 'oauth':
      return signInWithOAuth(client, method);
    case 'saml':
      return signUpWithSaml(method);
    default:
      throw new Error(`Unsupported auth method: ${(method as { type: string }).type}`);
  }
};
