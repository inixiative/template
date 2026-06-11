/**
 * @atlas
 * @kind store
 * @partOf primitive:ui
 */
import { fetchAndHydrateMe } from '@template/ui/lib/auth/fetchAndHydrateMe';
import { signIn as signInFn } from '@template/ui/lib/auth/signin';
import { signUp as signUpFn } from '@template/ui/lib/auth/signup';
import { clearToken, getToken } from '@template/ui/lib/auth/token';
import type { AuthMethod } from '@template/ui/lib/auth/types';
import type { AppStore } from '@template/ui/store/types';
import type { AuthSlice } from '@template/ui/store/types/auth';
import { createAuthClient } from 'better-auth/client';
import type { StateCreator } from 'zustand';

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set, get) => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const client = createAuthClient({ baseURL });

  // After any auth change, sync the websocket identity. The server re-validates
  // the token; the socket queues the send if it isn't open yet.
  const syncWsAuth = () => {
    const token = getToken();
    if (token) get().websocket.authenticate(token);
  };

  return {
    auth: {
      client,
      user: null,
      organizations: null,
      spaces: null,
      spaceUsers: null,
      strategy: { type: 'login' },
      spoofUserEmail: null,
      spoofingUserEmail: null,
      isAuthenticated: false,
      isEmbedded: false,
      isInitialized: false,

      initialize: async () => {
        if (get().auth.isInitialized) return;

        try {
          if (getToken()) {
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
        await signInFn(method);
        if (method.type !== 'oauth') {
          await fetchAndHydrateMe(set, get);
          syncWsAuth();
        }
      },

      signUp: async (method: AuthMethod) => {
        await signUpFn(method);
        if (method.type !== 'oauth') {
          await fetchAndHydrateMe(set, get);
          syncWsAuth();
        }
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
        const token = getToken();
        if (token) {
          if (email) get().websocket.spoof(token, email);
          else get().websocket.unspoof(token);
        }
      },

      logout: async () => {
        try {
          await client.signOut();
        } finally {
          get().websocket.logout();
          clearToken();
          set((state: AppStore) => ({
            auth: {
              ...state.auth,
              user: null,
              organizations: null,
              spaces: null,
              spoofUserEmail: null,
              spoofingUserEmail: null,
              isAuthenticated: false,
            },
          }));
          get().permissions.clear();
          get().tenant.setPublic();
          get().navigation.navigate?.({ to: '/login' });
        }
      },
    },
  };
};
