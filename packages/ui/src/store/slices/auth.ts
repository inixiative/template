/**
 * @atlas
 * @kind store
 * @partOf primitive:ui
 * @uses none
 */
import type { TwoFactorAction } from '@template/shared/auth/twoFactor';
import {
  type ChangePasswordInput,
  changePassword as changePasswordFn,
} from '@template/ui/lib/auth/changePassword';
import { fetchAndHydrateMe } from '@template/ui/lib/auth/fetchAndHydrateMe';
import { signIn as signInFn } from '@template/ui/lib/auth/signIn';
import { signUp as signUpFn } from '@template/ui/lib/auth/signUp';
import { storeJwtHandoff } from '@template/ui/lib/auth/storeJwtHandoff';
import { clearToken, fetchStoredTokenAndClearIfExpired } from '@template/ui/lib/auth/token';
import type { AuthMethod } from '@template/ui/lib/auth/types';
import type { AppStore } from '@template/ui/store/types';
import type { AuthSlice } from '@template/ui/store/types/auth';
import { createAuthClient } from 'better-auth/client';
import type { StateCreator } from 'zustand';

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set, get) => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const client = createAuthClient({ baseURL });

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
        await fetchAndHydrateMe(set, get);
        syncWsAuth();
      },

      signIn: async (method: AuthMethod) => {
        const result = await signInFn(method);
        if (result.status === 'authenticated') {
          await fetchAndHydrateMe(set, get);
          syncWsAuth();
        }
        return result;
      },

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
        const result = await signUpFn(method);
        if (result.status === 'verification-pending') clearLocalAuth();
        if (result.status === 'authenticated') {
          await fetchAndHydrateMe(set, get);
          syncWsAuth();
        }
        return result;
      },

      changePassword: async (input: ChangePasswordInput) => {
        const handoff = await changePasswordFn(input);
        if (get().auth.spoofUserEmail || !handoff.token) return;
        storeJwtHandoff(handoff);
        syncWsAuth();
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
