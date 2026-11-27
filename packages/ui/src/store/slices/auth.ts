/**
 * @atlas
 * @kind store
 * @partOf primitive:ui
 * @uses none
 */
import type { QueryClient } from '@tanstack/react-query';
import type { TwoFactorAction } from '@template/shared/auth/twoFactor';
import { exchangeOneTimeTokenForJwt } from '@template/ui/lib/auth/exchangeOneTimeTokenForJwt';
import { fetchAndHydrateMe } from '@template/ui/lib/auth/fetchAndHydrateMe';
import { requestPasswordReset } from '@template/ui/lib/auth/requestPasswordReset';
import { resetPassword } from '@template/ui/lib/auth/resetPassword';
import { signIn as signInFn } from '@template/ui/lib/auth/signIn';
import { signUp as signUpFn } from '@template/ui/lib/auth/signUp';
import { storeJwtHandoff } from '@template/ui/lib/auth/storeJwtHandoff';
import { clearToken, fetchStoredTokenAndClearIfExpired } from '@template/ui/lib/auth/token';
import type { AuthMethod } from '@template/ui/lib/auth/types';
import { MASTER_DATA_ENTRIES } from '@template/ui/lib/masterData/registry';
import type { AppStore } from '@template/ui/store/types';
import type { AuthSlice } from '@template/ui/store/types/auth';
import { createAuthClient } from 'better-auth/client';
import { oneTimeTokenClient } from 'better-auth/client/plugins';
import type { StateCreator } from 'zustand';

const MASTER_DATA_QUERY_IDS: ReadonlySet<string> = new Set(
  MASTER_DATA_ENTRIES.map(
    (entry) => (entry.queryKey[0] as { _id?: string } | undefined)?._id,
  ).filter((id): id is string => Boolean(id)),
);

const clearAuthenticatedQueries = (queryClient: QueryClient | null): void => {
  queryClient?.removeQueries({
    predicate: (query) => {
      if (query.meta?.public === true) return false;
      const first = query.queryKey[0];
      const id =
        typeof first === 'object' && first !== null ? (first as { _id?: unknown })._id : undefined;
      return !(typeof id === 'string' && MASTER_DATA_QUERY_IDS.has(id));
    },
  });
};

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set, get) => {
  const client = createAuthClient({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    plugins: [oneTimeTokenClient()],
    fetchOptions: { customFetchImpl: (input, init) => fetch(input, init) },
  });

  const syncWsAuth = () => {
    if (get().auth.twoFactorAction) return;
    const token = fetchStoredTokenAndClearIfExpired();
    if (!token) return;
    const spoofUserEmail = get().auth.spoofUserEmail;
    if (spoofUserEmail) {
      get().websocket.spoof(token, spoofUserEmail);
    } else {
      get().websocket.authenticate(token);
    }
  };

  const clearLocalAuth = () => {
    get().websocket.logout();
    clearToken();
    set((state: AppStore) => ({
      auth: {
        ...state.auth,
        user: null,
        organizations: null,
        organizationUsers: null,
        spaces: null,
        spaceUsers: null,
        spoofUserEmail: null,
        spoofingUserEmail: null,
        twoFactorAction: null,
        isAuthenticated: false,
      },
    }));
    get().permissions.clear();
    get().tenant.switchToPublicContext();
    clearAuthenticatedQueries(get().queryClient);
  };

  return {
    auth: {
      client,
      user: null,
      organizations: null,
      organizationUsers: null,
      spaces: null,
      spaceUsers: null,
      strategy: { type: 'login' },
      spoofUserEmail: null,
      spoofingUserEmail: null,
      twoFactorAction: null,
      isAuthenticated: false,
      isEmbedded: false,
      isInitialized: false,

      initialize: async () => {
        if (get().auth.isInitialized) return;

        try {
          if (fetchStoredTokenAndClearIfExpired()) {
            await fetchAndHydrateMe(set, get);
            syncWsAuth();
          }
        } catch (error) {
          await get().auth.logout();
          throw error;
        } finally {
          set((state: AppStore) => ({ auth: { ...state.auth, isInitialized: true } }));
        }
      },

      refreshMe: async () => {
        const previousUserId = get().auth.user?.id ?? null;
        const user = await fetchAndHydrateMe(set, get);
        if (previousUserId && previousUserId !== user.id) {
          clearAuthenticatedQueries(get().queryClient);
        }
        syncWsAuth();
      },

      signIn: async (method: AuthMethod) => {
        const result = await signInFn(client, method);
        if (result.status === 'authenticated') {
          clearAuthenticatedQueries(get().queryClient);
          await fetchAndHydrateMe(set, get);
          syncWsAuth();
        }
        return result;
      },

      completeOAuthSignIn: async (oneTimeToken: string) => {
        await exchangeOneTimeTokenForJwt(client, oneTimeToken);
        clearAuthenticatedQueries(get().queryClient);
        await fetchAndHydrateMe(set, get);
        syncWsAuth();
      },

      requestPasswordReset: (email: string) => requestPasswordReset(client, email),

      resetPassword: (input) => resetPassword(client, input),

      applyUpgradedJwt: (jwt, clearTwoFactorAction = true) => {
        if (!jwt) return;
        storeJwtHandoff(jwt);
        if (clearTwoFactorAction) {
          set((state: AppStore) => ({ auth: { ...state.auth, twoFactorAction: null } }));
        }
        syncWsAuth();
      },

      setTwoFactorAction: (action: TwoFactorAction | null) => {
        set((state: AppStore) => ({ auth: { ...state.auth, twoFactorAction: action } }));
        if (action === null) syncWsAuth();
      },

      signUp: async (method: AuthMethod) => {
        const result = await signUpFn(client, method);
        if (result.status === 'verification-pending') clearLocalAuth();
        if (result.status === 'authenticated') {
          clearAuthenticatedQueries(get().queryClient);
          await fetchAndHydrateMe(set, get);
          syncWsAuth();
        }
        return result;
      },

      setStrategy: (strategy) =>
        set((state) => ({
          auth: {
            ...state.auth,
            strategy,
            isEmbedded: strategy.type === 'embed',
          },
        })),

      setSpoof: async (email: string | null) => {
        clearAuthenticatedQueries(get().queryClient);
        set((state: AppStore) => ({ auth: { ...state.auth, spoofUserEmail: email } }));
        await fetchAndHydrateMe(set, get);
        const token = fetchStoredTokenAndClearIfExpired();
        if (token) {
          if (email) get().websocket.spoof(token, email);
          else get().websocket.unspoof(token);
        }
      },

      logout: async () => {
        clearLocalAuth();
        get().navigation.navigate?.({ to: '/login' });
      },
    },
  };
};
