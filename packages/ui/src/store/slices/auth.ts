import type { StateCreator } from 'zustand';
import { getToken, clearToken } from '@template/ui/lib/auth/token';
import { signIn as signInFn } from '@template/ui/lib/auth/signin';
import { signUp as signUpFn } from '@template/ui/lib/auth/signup';
import { fetchAndHydrateMe } from '@template/ui/lib/auth/fetchAndHydrateMe';
import { createAuthClient } from 'better-auth/client';
import type { AppStore } from '@template/ui/store/types';
import type { AuthSlice } from '@template/ui/store/types/auth';

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set, get) => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const client = createAuthClient({ baseURL });

  return {
    auth: {
      client,
      user: null,
      organizations: null,
      spaces: null,
      strategy: { type: 'login' },
      spoofUserEmail: null,
      spoofingUserEmail: null,
      isAuthenticated: false,
      isEmbedded: false,
      isInitialized: false,

    initialize: async () => {
      if (get().auth.isInitialized) return;

      try {
        if (getToken()) await fetchAndHydrateMe(set, get);
      } catch (error) {
        await get().auth.logout();
        throw error;
      } finally {
        set((state: AppStore) => ({ auth: { ...state.auth, isInitialized: true } }));
      }
    },

    signIn: async (credentials) => {
      await signInFn(credentials);
      await fetchAndHydrateMe(set, get);
    },

    signUp: async (credentials) => {
      await signUpFn(credentials);
      await fetchAndHydrateMe(set, get);
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
    },

      logout: async () => {
        try {
          await client.signOut();
        } finally {
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
