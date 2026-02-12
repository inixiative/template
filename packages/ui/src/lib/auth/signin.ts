import { createAuthClient } from 'better-auth/client';
import type { SignInCredentials } from '@template/ui/store/types/auth';
import { setToken } from '@template/ui/lib/auth/token';

const getAuthClient = () => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return createAuthClient({ baseURL });
};

export const signIn = async (credentials: SignInCredentials): Promise<void> => {
  const client = getAuthClient();

  const { data, error } = await client.signIn.email({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    throw new Error(error.message || 'Sign in failed');
  }

  if (!data?.token) {
    throw new Error('No token returned from sign in');
  }

  // Store the token - BetterAuth returns token directly
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  setToken(data.token, expiresAt);
};
