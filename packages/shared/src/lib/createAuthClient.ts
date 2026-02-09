import type { AuthSession, AuthUser } from '@template/shared/auth/types';
import { createAuthClient as createBetterAuthClient } from 'better-auth/client';

export const createAuthClient = (baseURL: string) => {
  const client = createBetterAuthClient({
    baseURL,
  });

  return {
    signIn: async (credentials: { email: string; password: string }) => {
      const result = await client.signIn.email(credentials);
      if (result.error || !result.data?.user) {
        throw new Error(result.error?.message || 'Sign in failed');
      }

      const now = new Date().toISOString();
      const session: AuthSession = {
        id: result.data.token ?? crypto.randomUUID(),
        userId: result.data.user.id,
        token: result.data.token ?? '',
        expiresAt: now,
        createdAt: now,
        ipAddress: null,
        userAgent: null,
      };

      return {
        user: {
          id: result.data.user.id,
          email: result.data.user.email,
          name: result.data.user.name ?? null,
          displayName: null,
          emailVerified: result.data.user.emailVerified,
          platformRole: 'user',
          createdAt: String(result.data.user.createdAt),
          updatedAt: String(result.data.user.updatedAt),
        } as AuthUser,
        session,
      };
    },
    signUp: async (credentials: { email: string; password: string; name?: string }) => {
      const result = await client.signUp.email({
        ...credentials,
        name: credentials.name ?? credentials.email,
      });
      if (result.error || !result.data?.user) {
        throw new Error(result.error?.message || 'Sign up failed');
      }

      const now = new Date().toISOString();
      const session: AuthSession = {
        id: result.data.token ?? crypto.randomUUID(),
        userId: result.data.user.id,
        token: result.data.token ?? '',
        expiresAt: now,
        createdAt: now,
        ipAddress: null,
        userAgent: null,
      };

      return {
        user: {
          id: result.data.user.id,
          email: result.data.user.email,
          name: result.data.user.name ?? null,
          displayName: null,
          emailVerified: result.data.user.emailVerified,
          platformRole: 'user',
          createdAt: String(result.data.user.createdAt),
          updatedAt: String(result.data.user.updatedAt),
        } as AuthUser,
        session,
      };
    },
    signOut: async () => {
      await client.signOut();
    },
  };
};

export type AuthClient = ReturnType<typeof createAuthClient>;
