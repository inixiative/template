/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */
import { clearToken, setToken } from '@template/ui/lib/auth/token';
import type {
  AuthMethod,
  EmailAuthMethod,
  OAuthAuthMethod,
  SamlAuthMethod,
  SignUpResult,
} from '@template/ui/lib/auth/types';
import { createAuthClient } from 'better-auth/client';

const getAuthClient = () => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return createAuthClient({ baseURL });
};

const signUpWithEmail = async (method: EmailAuthMethod): Promise<SignUpResult> => {
  if (!method.name) {
    throw new Error('Name is required for signup');
  }

  const client = getAuthClient();

  const { data, error } = await client.signUp.email({
    email: method.email,
    password: method.password,
    name: method.name,
  });

  if (error) {
    throw new Error(error.message || 'Sign up failed');
  }

  if (!data?.token) {
    if (data?.token === null && data.user?.emailVerified === false) {
      clearToken();
      return { status: 'verification-pending', email: method.email };
    }
    throw new Error('No token returned from sign up');
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  setToken(data.token, expiresAt);
  return { status: 'authenticated' };
};

const signUpWithOAuth = async (method: OAuthAuthMethod): Promise<SignUpResult> => {
  const client = getAuthClient();

  const callbackURL = method.callbackURL || `${window.location.origin}/auth/callback`;

  const { error } = await client.signIn.social({
    provider: method.provider,
    callbackURL,
    errorCallbackURL: `${window.location.origin}/login`,
  });
  if (error) throw new Error(error.message || 'Sign up failed');
  return { status: 'redirecting' };
};

const signUpWithSaml = async (_method: SamlAuthMethod): Promise<SignUpResult> => {
  throw new Error('SAML authentication not yet implemented');
};

export const signUp = async (method: AuthMethod): Promise<SignUpResult> => {
  switch (method.type) {
    case 'email':
      return signUpWithEmail(method);
    case 'oauth':
      return signUpWithOAuth(method);
    case 'saml':
      return signUpWithSaml(method);
    default:
      throw new Error(`Unsupported auth method: ${(method as { type: string }).type}`);
  }
};
