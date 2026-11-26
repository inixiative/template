/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */
import { betterAuthClient } from '@template/ui/lib/auth/betterAuthClient';
import { storeJwtHandoff } from '@template/ui/lib/auth/storeJwtHandoff';
import type {
  AuthMethod,
  EmailAuthMethod,
  OAuthAuthMethod,
  SamlAuthMethod,
  SignInResult,
} from '@template/ui/lib/auth/types';

const signInWithEmail = async (method: EmailAuthMethod): Promise<SignInResult> => {
  const client = betterAuthClient();

  const { data, error } = await client.signIn.email({
    email: method.email,
    password: method.password,
  });

  if (error) {
    throw new Error(error.message || error.statusText);
  }

  storeJwtHandoff(data);
  return { status: 'authenticated' };
};

const signInWithOAuth = async (method: OAuthAuthMethod): Promise<SignInResult> => {
  const client = betterAuthClient();

  const callbackURL = method.callbackURL || `${window.location.origin}/auth/callback`;

  await client.signIn.social({
    provider: method.provider,
    callbackURL,
    errorCallbackURL: `${window.location.origin}/login`,
  });
  return { status: 'redirecting' };
};

export const completeOAuthSignIn = async (oneTimeToken: string): Promise<void> => {
  const client = betterAuthClient();

  const { data, error } = await client.oneTimeToken.verify({ token: oneTimeToken });

  if (error) {
    throw new Error(error.message || error.statusText);
  }

  storeJwtHandoff(data);
};

const signInWithSaml = async (_method: SamlAuthMethod): Promise<SignInResult> => {
  throw new Error('SAML authentication not yet implemented');
};

export const signIn = async (method: AuthMethod): Promise<SignInResult> => {
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
