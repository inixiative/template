/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */
import { storeJwtHandoff } from '@template/ui/lib/auth/storeJwtHandoff';
import type {
  AuthMethod,
  EmailAuthMethod,
  OAuthAuthMethod,
  SamlAuthMethod,
} from '@template/ui/lib/auth/types';
import { createAuthClient } from 'better-auth/client';
import { oneTimeTokenClient } from 'better-auth/client/plugins';

const getAuthClient = () => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return createAuthClient({ baseURL, plugins: [oneTimeTokenClient()] });
};

const signInWithEmail = async (method: EmailAuthMethod): Promise<void> => {
  const client = getAuthClient();

  const { data, error } = await client.signIn.email({
    email: method.email,
    password: method.password,
  });

  if (error) {
    throw new Error(error.message || error.statusText);
  }

  storeJwtHandoff(data);
};

const signInWithOAuth = async (method: OAuthAuthMethod): Promise<void> => {
  const client = getAuthClient();

  const callbackURL = method.callbackURL || `${window.location.origin}/auth/callback`;

  await client.signIn.social({
    provider: method.provider,
    callbackURL,
    errorCallbackURL: `${window.location.origin}/login`,
  });
};

export const completeOAuthSignIn = async (oneTimeToken: string): Promise<void> => {
  const client = getAuthClient();

  const { data, error } = await client.oneTimeToken.verify({ token: oneTimeToken });

  if (error) {
    throw new Error(error.message || error.statusText);
  }

  storeJwtHandoff(data);
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
      throw new Error(`Unsupported auth method: ${(method as { type: string }).type}`);
  }
};
