import { createAuthClient as createBetterAuthClient } from 'better-auth/client';

export function createAuthClient(baseURL: string) {
  return createBetterAuthClient({
    baseURL,
  });
}

export type AuthClient = ReturnType<typeof createAuthClient>;
