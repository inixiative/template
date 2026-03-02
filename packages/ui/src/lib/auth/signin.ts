import { createAuthClient } from 'better-auth/client';
import { setToken } from '@template/ui/lib/auth/token';
import type { AuthMethod, EmailAuthMethod, OAuthAuthMethod, SamlAuthMethod } from '@template/ui/lib/auth/types';

const getAuthClient = () => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return createAuthClient({ baseURL });
};

const signInWithEmail = async (method: EmailAuthMethod): Promise<void> => {
  const client = getAuthClient();

  const { data, error } = await client.signIn.email({
    email: method.email,
    password: method.password,
  });

  if (error) {
    throw new Error(error.message || 'Sign in failed');
  }

  if (!data?.token) {
    throw new Error('No token returned from sign in');
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  setToken(data.token, expiresAt);
};

const signInWithOAuth = async (method: OAuthAuthMethod): Promise<void> => {
  const client = getAuthClient();

  const callbackURL = method.callbackURL || `${window.location.origin}/auth/callback`;

  await client.signIn.social({
    provider: method.provider,
    callbackURL,
  });
};

const signInWithSaml = async (_method: SamlAuthMethod): Promise<void> => {
  throw new Error('SAML authentication not yet implemented');
};

export const signIn = async (method: AuthMethod): Promise<void> => {
  switch (method.type) {
    case 'email':
      return signInWithEmail(method);
    case 'oauth':
      return signInWithOAuth(method);
    case 'saml':
      return signInWithSaml(method);
    default:
      throw new Error(`Unsupported auth method: ${(method as any).type}`);
  }
};
