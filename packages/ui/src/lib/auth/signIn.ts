/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */
import { storeJwtHandoff } from '@template/ui/lib/auth/storeJwtHandoff';
import { throwBetterAuthError } from '@template/ui/lib/auth/throwBetterAuthError';
import type {
  AuthMethod,
  EmailAuthMethod,
  OAuthAuthMethod,
  SamlAuthMethod,
  SignInResult,
} from '@template/ui/lib/auth/types';
import type { BetterAuthClient } from '@template/ui/store/types/auth';

const signInWithEmail = async (
  client: BetterAuthClient,
  method: EmailAuthMethod,
): Promise<SignInResult> => {
  const { data, error } = await client.signIn.email({
    email: method.email,
    password: method.password,
  });

  if (error) throwBetterAuthError(error);

  storeJwtHandoff(data);
  return { status: 'authenticated' };
};

const signInWithOAuth = async (
  client: BetterAuthClient,
  method: OAuthAuthMethod,
): Promise<{ status: 'redirecting' }> => {
  const callbackURL = method.callbackURL || `${window.location.origin}/auth/callback`;

  const { error } = await client.signIn.social({
    provider: method.provider,
    callbackURL,
    errorCallbackURL: `${window.location.origin}/login`,
  });
  if (error) throwBetterAuthError(error);
  return { status: 'redirecting' };
};

const signInWithSaml = async (_method: SamlAuthMethod): Promise<SignInResult> => {
  throw new Error('SAML authentication not yet implemented');
};

export const signIn = async (
  client: BetterAuthClient,
  method: AuthMethod,
): Promise<SignInResult> => {
  switch (method.type) {
    case 'email':
      return signInWithEmail(client, method);
    case 'oauth':
      return signInWithOAuth(client, method);
    case 'saml':
      return signInWithSaml(method);
    default:
      throw new Error(`Unsupported auth method: ${(method as { type: string }).type}`);
  }
};
